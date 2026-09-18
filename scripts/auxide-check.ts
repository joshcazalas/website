import { enterFactory as ready } from './browser-helpers.ts';
import { chromium, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('.local/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,
  args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const base=process.env.TEST_URL||'http://127.0.0.1:5173/';
const errors: string[] = [];
const watch=(page: Page) =>{
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
};
const read=(page: Page) =>page.evaluate(()=>window.__factory.auxide);
const repoUrl='https://github.com/joshcazalas/auxide';
const mapRepo=`.world-link[href="${repoUrl}"]`;
const checkRepoTab=async (page: Page, activate: () => Promise<unknown>)=>{
  // Exercise the map anchor without contacting the external site.
  await page.context().route(repoUrl,route=>route.fulfill({contentType:'text/html',body:'<title>Repository</title>'}));
  const opened=page.waitForEvent('popup');
  await activate();
  const tab=await opened;
  await tab.waitForURL(repoUrl);await tab.close();await page.bringToFront();
  assert.equal(await page.evaluate(()=>window.__factory.destination),'auxide');
};
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});watch(page);
  const audioRequests: string[] = [];
  page.on('request',r=>{if(r.url().includes('/sound/'))audioRequests.push(r.url());});
  await page.goto(new URL('#auxide',base).href);await ready(page);
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(()=>window.__factory.destination),'auxide');
  assert(await page.locator('#auxide-panel').isVisible());
  assert(!(await page.locator('#foundation-panel').isVisible()));
  assert.equal(await page.locator('#auxide-panel .source-link').getAttribute('href'),'https://github.com/joshcazalas/auxide');
  assert.equal((await read(page)).audio.context,'uninitialized','No audio context before opt-in');
  assert.equal(audioRequests.length,0,'Do not fetch audio before opt-in');
  await page.screenshot({path:'.local/screenshots/auxide-desktop.png'});
  const repo=page.locator(mapRepo);
  assert(await repo.isVisible(),'The pixel repository URL is a visible link');
  assert.equal(await repo.getAttribute('target'),'_blank');
  await repo.hover();await page.screenshot({path:'.local/screenshots/auxide-repo-link.png'});
  await checkRepoTab(page,()=>repo.click());
  await repo.focus();await checkRepoTab(page,()=>page.keyboard.press('Enter'));

  await page.locator('#auxide-toggle').click();
  const stopped=await read(page);
  assert.equal(stopped.players[0].playing,false);
  await page.waitForTimeout(700);
  const later=await read(page);
  assert.equal(later.players[0].total,stopped.players[0].total,'Paused guild must stay still');
  for(const i of [1,2])assert(later.players[i].total>stopped.players[i].total+0.4,'Other guilds keep running');
  await page.screenshot({path:'.local/screenshots/auxide-independent-playback.png'});
  await page.locator('#auxide-skip').click();
  const skipped=await read(page);
  assert.equal(skipped.players[0].title,stopped.players[0].queue[0]);
  assert.equal(skipped.players[0].playing,false,'Skip does not unpause a guild');
  assert.equal(skipped.players[0].position,0);
  for(const i of [1,2])assert.equal(skipped.players[i].generation,stopped.players[i].generation);
  await page.locator('#auxide-toggle').click();
  await page.locator('[data-server="1"]').click();
  assert.equal((await read(page)).selected,1);

  await page.locator('#auxide-sound').click();
  await page.waitForFunction(()=>window.__factory.auxide.audio.status==='on',null,{timeout:15000});
  await page.waitForFunction(()=>window.__factory.auxide.audio.scheduledNotes>2);
  const audio=(await read(page)).audio;
  assert.equal(audio.context,'running');assert.equal(audio.samples,9);
  assert.equal(new Set(audioRequests).size,9);
  await page.locator('#auxide-toggle').click();
  const quiet=(await read(page)).audio.scheduledNotes;
  await page.waitForTimeout(450);
  assert.equal((await read(page)).audio.scheduledNotes,quiet,'Paused server must not schedule sound');
  assert.equal((await read(page)).audio.activeSources,0,'Pause cancels queued and sounding notes');
  await page.locator('[data-server="2"]').click();
  await page.waitForFunction(n=>window.__factory.auxide.audio.scheduledNotes>n,quiet);

  await page.locator('#pause').click();
  const frozen=await read(page);
  await page.waitForTimeout(400);
  assert.deepEqual((await read(page)).players,frozen.players,'Global pause freezes every guild');
  assert.equal((await read(page)).audio.activeSources,0);
  await page.locator('#pause').click();
  await page.waitForFunction(n=>window.__factory.auxide.audio.scheduledNotes>n,frozen.audio.scheduledNotes);
  await page.locator('#auxide-sound').click();
  assert.equal((await read(page)).audio.enabled,false);
  assert.equal((await read(page)).audio.activeSources,0);

  // Leaving an audible outpost must stop it, including when navigating to another project.
  await page.locator('#auxide-sound').click();
  await page.waitForFunction(()=>window.__factory.auxide.audio.status==='on');
  await page.locator('.slot[data-go="aws-foundation"]').click();
  assert.equal(await page.evaluate(()=>window.__factory.destination),'aws-foundation');
  assert.equal((await read(page)).audio.enabled,false);
  assert.equal((await read(page)).audio.activeSources,0);
  assert(await page.locator('#foundation-panel').isVisible());
  assert(!(await page.locator('#auxide-panel').isVisible()));
  await page.goBack();
  await page.waitForFunction(()=>window.__factory.destination==='auxide');
  assert.equal((await read(page)).selected,2,'Back preserves selection');
  assert.equal((await read(page)).players[1].playing,false,'Back preserves independent paused state');
  assert.equal((await read(page)).audio.enabled,false,'Back does not turn sound back on');
  await page.locator('#auxide-panel .project-details summary').click();
  assert.match(await page.locator('#auxide-panel .project-details').innerText(),/own queue and playback state/);
  await page.locator('#factory-canvas').focus();await page.keyboard.press('h');
  await page.waitForFunction(()=>window.__factory.destination==='home');
  assert.equal(new URL(page.url()).hash,'');
  console.log('Passed: independent clocks, skip/pause, audio opt-in and decoding, cancellation, project switching, browser history, and Home.');

  await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});watch(mobile);
  await mobile.goto(new URL('#auxide',base).href);await ready(mobile);
  assert(await mobile.evaluate(()=>window.__factory.paused));
  const still=(await read(mobile)).players;
  await mobile.waitForTimeout(300);
  assert.deepEqual((await read(mobile)).players,still);
  assert.equal((await read(mobile)).audio.context,'uninitialized');
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
  for(const selector of ['#auxide-toggle','#auxide-skip','#auxide-sound','#auxide-panel .source-link','#auxide-panel .project-details summary']) {
    const b=await mobile.locator(selector).boundingBox();
    assert(b&&b.x>=0&&b.x+b.width<=390&&b.y>=0&&b.y+b.height<=844,`${selector} must fit the mobile viewport`);
  }
  await mobile.screenshot({path:'.local/screenshots/auxide-mobile.png'});
  assert(await mobile.locator(mapRepo).isVisible());
  await checkRepoTab(mobile,()=>mobile.locator(mapRepo).tap());
  await mobile.locator('[data-server="2"]').tap();
  await mobile.locator('#auxide-skip').tap();
  assert.notEqual((await read(mobile)).players[2].title,still[2].title);
  assert.deepEqual((await read(mobile)).players.slice(0,2),still.slice(0,2));
  await mobile.locator('#auxide-panel .project-details summary').tap();
  assert(await mobile.locator('#auxide-panel .project-details').evaluate(e => e instanceof HTMLDetailsElement && e.open));
  await mobile.locator('#auxide-panel .source-link').scrollIntoViewIfNeeded();
  await mobile.screenshot({path:'.local/screenshots/auxide-mobile-details.png'});
  await mobile.locator('.slot[data-go="home"]').tap();
  assert(!(await mobile.locator('#auxide-panel').isVisible()));
  assert.deepEqual(errors,[],'No browser or asset errors');
  console.log('Passed: mobile direct link, pixel GitHub link with click/keyboard/touch activation, controls, project details, reduced motion, and silent default.');
} finally {await browser.close();}
