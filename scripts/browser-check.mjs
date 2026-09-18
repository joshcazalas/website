import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('.local/screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: process.env.MOBILE_ONLY ? { width: 390, height: 844 } : { width: 1600, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:5173/');
  await page.waitForFunction(() => window.__factory?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: process.env.MOBILE_ONLY ? '.local/screenshots/home-mobile.png' : '.local/screenshots/home-desktop.png' });
  console.log('Factory loaded:', await page.evaluate(() => {const {trains,...state}=window.__factory;return {...state,trains:trains.length};}));
  if (process.env.VISUAL_ONLY) process.exitCode = 0;
  else {
    const before = await page.evaluate(() => window.__factory.camera);
    await page.mouse.move(600, 700); await page.mouse.down(); await page.mouse.move(780, 750, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.__factory.camera);
    assert(after.x < before.x - 200, 'Dragging must move the camera');
    await page.mouse.wheel(0, -450); await page.waitForTimeout(800);
    assert((await page.evaluate(() => window.__factory.camera.zoom)) > before.zoom, 'Wheel must zoom');
    await page.locator('.slot[data-go="factory"]').click(); await page.waitForTimeout(1000);
    await page.screenshot({ path: '.local/screenshots/production-desktop.png' });
    await page.locator('#pause').click();
    const time = await page.evaluate(() => window.__factory.time);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__factory.time), time, 'Pause must freeze animation');
    await page.locator('#pause').click(); await page.waitForTimeout(250);
    assert((await page.evaluate(() => window.__factory.time)) > time, 'Resume must advance animation');
    await page.locator('#about-open').click();
    assert(await page.locator('#dossier').isVisible(), 'Dossier must open');
    assert.equal(await page.locator('#dossier .project').count(), 3);
    await page.screenshot({ path: '.local/screenshots/dossier-desktop.png' });
    await page.keyboard.press('Escape');
    assert(!(await page.locator('#dossier').isVisible()), 'Escape must close the dossier');
    await page.locator('#factory-canvas').focus(); await page.keyboard.press('h'); await page.waitForTimeout(900);
    assert.equal(await page.locator('.world-link[href="mailto:joshuacazalas@gmail.com"]').count(), 1);
    await page.keyboard.press('m'); await page.waitForTimeout(900);
    await page.screenshot({ path: '.local/screenshots/overview-desktop.png' });
    const readTrains=()=>page.evaluate(()=>({wall:performance.now()/1000,time:window.__factory.time,trains:window.__factory.trains}));
    const start=await readTrains();
    let previous=start;
    const wrapped=new Set();
    // Observe a full circuit in the rendered scene, including off-camera cars.
    while(previous.time-start.time<start.trains[0].period+.3) {
      await page.waitForTimeout(500);
      const current=await readTrains(),dt=current.time-previous.time;
      assert.deepEqual(current.trains.map(t=>t.id),start.trains.map(t=>t.id),'The same trains must persist');
      for(let i=0;i<current.trains.length;i++) {
        const train=current.trains[i],old=previous.trains[i];
        assert.equal(train.cars.length,old.cars.length,'No carriages may disappear at loop joins');
        if(train.distance<old.distance)wrapped.add(train.id);
        for(let car=0;car<train.cars.length;car++) {
          const a=old.cars[car],b=train.cars[car];
          assert(Number.isFinite(b.x)&&Number.isFinite(b.y));
          assert(Math.hypot(a.x-b.x,a.y-b.y)<=2304*dt+2,`${train.id}: carriage teleported`);
        }
        if(train.id.includes('mainline')) {
          const travelled=(train.distance-old.distance+train.length)%train.length;
          assert(Math.abs(travelled-train.speed*dt)<1,'Cruise speed must remain constant through loop joins');
        }
      }
      previous=current;
    }
    assert(wrapped.has(start.trains[0].id),'Observe the lead train complete a lap');
    assert(Math.abs((previous.time-start.time)-(previous.wall-start.wall))<.6,'Slow rendering must not slow the animation clock');
    console.log('Passed: persistent trains, full-loop carriage continuity, cruising speed, and real-time animation.');
    for(const destination of ['research','power']) {
      await page.locator(`.slot[data-go="${destination}"]`).click();
      await page.waitForTimeout(1100);
      await page.screenshot({path:`.local/screenshots/${destination}-desktop.png`});
    }
    await page.close();
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(process.env.TEST_URL || 'http://127.0.0.1:5173/');
    await mobile.waitForFunction(() => window.__factory?.ready, null, { timeout: 60000 });
    await mobile.waitForTimeout(700);
    assert(await mobile.evaluate(() => window.__factory.paused), 'Reduced motion must start paused');
    const parked=await mobile.evaluate(()=>window.__factory.trains);
    await mobile.waitForTimeout(300);
    assert.deepEqual(await mobile.evaluate(()=>window.__factory.trains),parked,'Reduced motion must freeze all trains');
    assert(await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth), 'Mobile must fit viewport');
    await mobile.screenshot({ path: '.local/screenshots/home-mobile.png' });
    await mobile.locator('#about-open').click();
    assert(await mobile.locator('#dossier').isVisible());
    await mobile.screenshot({ path: '.local/screenshots/dossier-mobile.png' });
    assert.deepEqual(errors, [], 'Browser must have no runtime or loading errors');
    console.log('Passed: loading, drag, zoom, navigation, pause/resume, dossier, links, mobile layout, reduced motion.');
  }
  if (errors.length) console.log('Browser errors:', errors);
} finally { await browser.close(); }
