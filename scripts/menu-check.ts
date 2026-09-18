import { chromium, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { enterFactory } from './browser-helpers.ts';
await mkdir('.local/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const base=process.env.TEST_URL||'http://127.0.0.1:5173/';
const ready=(page: Page) =>page.waitForFunction(()=>window.__factory?.ready,null,{timeout:60000});
const errors: string[] = [];
const watch=(page: Page) =>page.on('pageerror',e=>errors.push(e.message));
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});watch(page);
  await page.goto(base);await ready(page);
  assert.equal(await page.locator('#entry-screen button:visible').count(),1);
  assert(await page.locator('.entry-brand img[alt="Josh Cazalas"]').evaluate(e=>e instanceof HTMLImageElement && e.complete && e.naturalWidth>0));
  assert(await page.locator('#factory-shell').evaluate(e => e instanceof HTMLElement && e.hidden));
  assert(await page.locator('#factory-shell').evaluate(e => e instanceof HTMLElement && e.inert));
  const before=await page.evaluate(()=>({time:window.__factory.time,menu:window.__factory.menu,camera:window.__factory.camera}));
  await page.waitForTimeout(700);
  const after=await page.evaluate(()=>({time:window.__factory.time,menu:window.__factory.menu,camera:window.__factory.camera}));
  assert.equal(after.time,before.time);assert(after.menu.seconds>before.menu.seconds);
  assert.notDeepEqual(after.menu.trains,before.menu.trains);
  await page.keyboard.press('m');assert.deepEqual(await page.evaluate(()=>window.__factory.camera),before.camera);
  await page.screenshot({path:'.local/screenshots/menu-rail.png'});
  await page.waitForFunction(()=>window.__factory.menu.index===1,null,{timeout:25000});
  await page.waitForTimeout(400);await page.screenshot({path:'.local/screenshots/menu-research.png'});
  // Capture the initial loading state in the same browser event as Play. On a
  // slow runner the 1.4s transition can finish between separate protocol calls.
  await page.evaluate(()=>{
    document.querySelector<HTMLElement>('#play-factory')!.addEventListener('click',()=>{
      const shell=document.querySelector<HTMLElement>('#factory-shell')!;
      window.__menuLoadingSnapshot={
        phase:document.querySelector<HTMLElement>('#entry-screen')!.dataset.state,
        loadingVisible:!document.querySelector<HTMLElement>('#entry-loading')!.hidden,
        shellHidden:shell.hidden,
        shellInert:shell.inert,
      };
    },{once:true});
  });
  await page.locator('#play-factory').focus();await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(()=>window.__menuLoadingSnapshot),{
    phase:'loading',loadingVisible:true,shellHidden:true,shellInert:true,
  });
  await page.waitForFunction(()=>window.__factory.entered);
  await page.waitForFunction(()=>document.querySelector<HTMLElement>('#entry-screen')!.hidden);
  assert(!(await page.locator('#factory-shell').evaluate(e => e instanceof HTMLElement && e.hidden)));
  assert(await page.locator('#map').isVisible());
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'factory-canvas');
  const stopped=await page.evaluate(()=>window.__factory.menu.seconds);await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.__factory.menu.seconds),stopped);
  assert.equal(await page.locator('.quickbar .slot:visible').count(),5);
  await page.screenshot({path:'.local/screenshots/home-project-quickbar.png'});
  for(const project of ['aws-foundation','auxide','caz-nix']) {
    await page.locator(`.slot[data-go="${project}"]`).click();
    assert.equal(await page.evaluate(()=>window.__factory.destination),project);
    assert(!(await page.locator('#entry-screen').isVisible()));
  }
  for(const [key,destination] of [['1','home'],['2','aws-foundation'],['3','auxide'],['4','caz-nix']]) {
    await page.locator('#factory-canvas').focus();await page.keyboard.press(key);
    assert.equal(await page.evaluate(()=>window.__factory.destination),destination);
    assert(await page.locator(`.slot[data-go="${destination}"]`).evaluate(e=>e.classList.contains('active')));
  }
  await page.goBack();await page.waitForFunction(()=>window.__factory.destination==='auxide');
  await page.goForward();await page.waitForFunction(()=>window.__factory.destination==='caz-nix');
  await page.close();
  console.log('Passed: one Play option, animated rotating scenes, independent clocks, keyboard entry, loading, and all project destinations.');

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(mobile);
  await mobile.goto(new URL('#caz-nix',base).href);await ready(mobile);
  const still=await mobile.evaluate(()=>window.__factory.menu);await mobile.waitForTimeout(300);
  assert.deepEqual(await mobile.evaluate(()=>window.__factory.menu),still);
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  await mobile.screenshot({path:'.local/screenshots/menu-mobile.png'});
  await enterFactory(mobile);
  assert.equal(await mobile.evaluate(()=>window.__factory.destination),'caz-nix');
  assert(await mobile.evaluate(()=>window.__factory.paused));
  for(const destination of ['home','aws-foundation','auxide','caz-nix']) {
    await mobile.locator(`.slot[data-go="${destination}"]`).tap();
    assert.equal(await mobile.evaluate(()=>window.__factory.destination),destination);
    assert.equal(await mobile.locator('.quickbar .slot:visible').count(),5);
    for(const slot of await mobile.locator('.quickbar .slot').all()) {
      const b=await slot.boundingBox();
      assert(b&&b.x>=0&&b.x+b.width<=390&&b.y>=0&&b.y+b.height<=844,'Every quickbar button fits on mobile');
    }
  }
  await mobile.screenshot({path:'.local/screenshots/project-quickbar-mobile.png'});
  await mobile.close();
  console.log('Passed: mobile layout, still reduced-motion backdrop, Play, and preserved project deep link.');

  const slow=await browser.newPage({viewport:{width:1280,height:800}});watch(slow);
  const { promise: gate, resolve: release } = Promise.withResolvers<void>();
  await slow.route('**/factorio/packed/manifest.json',async route=>{await gate;await route.continue();});
  await slow.goto(base);await slow.locator('#play-factory').click();await slow.waitForTimeout(1650);
  assert(await slow.locator('#entry-loading').isVisible());assert(await slow.locator('#factory-shell').evaluate(e => e instanceof HTMLElement && e.hidden));
  await slow.screenshot({path:'.local/screenshots/menu-loading.png'});
  release();await slow.waitForFunction(()=>window.__factory?.entered,null,{timeout:60000});await slow.close();

  const broken=await browser.newPage({viewport:{width:1280,height:800}});watch(broken);
  await broken.route('**/factorio/packed/manifest.json',route=>route.fulfill({status:404,body:'Missing assets'}));
  await broken.goto(base);await broken.locator('#entry-retry').waitFor({state:'visible'});
  assert(await broken.locator('#factory-shell').evaluate(e => e instanceof HTMLElement && e.hidden));
  assert.match(await broken.locator('#entry-error').innerText(),/assets:import/);
  await broken.unroute('**/factorio/packed/manifest.json');
  await broken.locator('#entry-retry').click();await broken.locator('#play-factory').waitFor({state:'visible'});
  await enterFactory(broken);await broken.close();
  assert.deepEqual(errors,[]);
  console.log('Passed: slow loads remain guarded, missing assets show an error, and retry recovers.');
} finally {await browser.close();}
