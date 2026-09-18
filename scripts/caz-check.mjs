import { enterFactory as ready } from './browser-helpers.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('.local/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const base=process.env.TEST_URL||'http://127.0.0.1:5173/';
const errors=[];
const watch=page=>{
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
};
const state=page=>page.evaluate(()=>window.__factory.caz);
const phase=(page,value)=>page.waitForFunction(value=>window.__factory.caz.phase===value,value,{timeout:35000});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});watch(page);
  await page.goto(base);await ready(page);
  await page.locator('#projects-open').click();
  await page.locator('#projects a[href="#caz-nix"]').click();
  assert.equal(new URL(page.url()).hash,'#caz-nix');
  assert.equal(await page.title(),'caz.nix — Josh Cazalas');
  assert(await page.locator('#caz-panel').isVisible());
  assert(!(await page.locator('#auxide-panel').isVisible()));
  assert(!(await page.locator('#foundation-panel').isVisible()));
  assert.equal((await state(page)).phase,'ready');
  assert.equal(await page.locator('#caz-panel .source-link').getAttribute('href'),'https://github.com/joshcazalas/caz.nix');
  await page.waitForTimeout(1200);
  await page.screenshot({path:'.local/screenshots/caz-desktop.png'});

  await page.locator('#caz-deploy').click();await phase(page,'verify');
  assert(await page.locator('#caz-deploy').isDisabled());
  assert(await page.locator('#caz-failure').isDisabled());
  await phase(page,'build');
  await page.locator('#pause').click();
  const frozen=await state(page);await page.waitForTimeout(350);
  assert.deepEqual(await state(page),frozen);
  assert.match(await page.locator('#caz-status').innerText(),/paused/);
  await page.locator('#pause').click();
  await phase(page,'activate');
  assert((await state(page)).archived);
  await phase(page,'accepted');
  const healthy=await state(page);assert.equal(healthy.active,2);assert(!healthy.quarantined);
  await page.screenshot({path:'.local/screenshots/caz-accepted.png'});
  console.log('Passed: directory, scene loading, healthy release, archival before activation, pause/resume, and acceptance.');

  await page.locator('#caz-failure').check();await page.locator('#caz-deploy').click();
  await phase(page,'confirm');
  assert.equal((await state(page)).active,3);assert((await state(page)).unhealthy);
  await page.locator('#pause').click();
  await page.screenshot({path:'.local/screenshots/caz-failed.png'});
  await page.locator('#pause').click();
  await phase(page,'rollback');await phase(page,'restore');
  assert.equal((await state(page)).active,2);
  await phase(page,'recovered');
  const recovered=await state(page);assert(recovered.quarantined);assert(!recovered.unhealthy);assert(recovered.archived);
  assert.equal(recovered.activeSlot,healthy.activeSlot);
  await page.screenshot({path:'.local/screenshots/caz-recovered.png'});
  await page.locator('#caz-panel .project-details summary').click();
  assert.match(await page.locator('#caz-panel .project-details').innerText(),/explicit restoration/);
  await page.locator('#caz-panel .project-details summary').click();
  await page.locator('#caz-failure').uncheck();await page.locator('#caz-deploy').click();await page.locator('#caz-finish').click();
  await phase(page,'accepted');assert.equal((await state(page)).active,4);

  // Browser history and moving between all three projects preserve release state.
  for(const destination of ['auxide','aws-foundation']) {
    await page.locator('#projects-open').click();
    await page.locator(`#projects a[href="#${destination}"]`).click();
    assert(!(await page.locator('#caz-panel').isVisible()));
    await page.goBack();
    await page.waitForFunction(()=>window.__factory.destination==='caz-nix');
    assert.equal((await state(page)).active,4);
  }
  await page.locator('#factory-canvas').focus();await page.keyboard.press('h');
  await page.waitForFunction(()=>window.__factory.destination==='home');
  assert.equal(new URL(page.url()).hash,'');
  await page.locator('#about-open').click();await page.locator('#dossier a[href="#caz-nix"]').click();
  assert(await page.locator('#caz-panel').isVisible());
  assert(!(await page.locator('#dossier').isVisible()));
  assert.equal((await state(page)).active,4);
  console.log('Passed: confirmed failure, rollback, restored health, quarantine, repeated releases, skip, project navigation, history, About, and Home.');
  await page.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(mobile);
  await mobile.goto(new URL('#caz-nix',base).href);await ready(mobile);
  assert(await mobile.evaluate(()=>window.__factory.paused));
  assert.match(await mobile.locator('#caz-deploy').innerText(),/instantly/);
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  for(const selector of ['#caz-deploy','#caz-failure','#caz-panel .source-link','#caz-panel .project-details summary']) {
    const b=await mobile.locator(selector).boundingBox();
    assert(b&&b.x>=0&&b.x+b.width<=390&&b.y>=0&&b.y+b.height<=844,`${selector} must fit mobile`);
  }
  await mobile.screenshot({path:'.local/screenshots/caz-mobile.png'});
  await mobile.locator('#caz-failure').check();await mobile.locator('#caz-deploy').tap();await phase(mobile,'recovered');
  const still=await state(mobile);await mobile.waitForTimeout(350);assert.deepEqual(await state(mobile),still);
  assert.equal(still.active,1);assert(still.quarantined);
  await mobile.locator('#caz-failure').uncheck();await mobile.locator('#caz-deploy').tap();await phase(mobile,'accepted');
  assert.equal((await state(mobile)).active,3);
  await mobile.locator('#caz-panel .project-details summary').tap();
  assert(await mobile.locator('#caz-panel .project-details').evaluate(e=>e.open));
  await mobile.locator('#caz-panel .source-link').scrollIntoViewIfNeeded();
  await mobile.screenshot({path:'.local/screenshots/caz-mobile-details.png'});
  await mobile.locator('.slot[data-go="home"]').tap();
  assert(!(await mobile.locator('#caz-panel').isVisible()));
  assert.deepEqual(errors,[],'No rendering, asset, or runtime errors');
  console.log('Passed: direct link, mobile controls and details, reduced motion, instant recovery and success, and return home.');
} finally {await browser.close();}
