import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('.local/screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
const errors = [];
const watch = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
};
const state = page => page.evaluate(() => window.__factory.outpost);
const ready = page => page.waitForFunction(() => window.__factory?.ready, null, { timeout: 60000 });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); watch(page);
  await page.goto(base); await ready(page);
  await page.locator('#projects-open').click();
  assert(await page.locator('#projects').isVisible());
  await page.locator('#projects a[href="#aws-foundation"]').click();
  await page.waitForTimeout(1000);
  assert.equal(new URL(page.url()).hash, '#aws-foundation');
  assert(!(await page.locator('#projects').isVisible()));
  assert(await page.locator('#foundation-panel').isVisible());
  assert.equal((await state(page)).phase, 'ready');
  assert.equal((await state(page)).built, 0);
  assert.equal(await page.locator('#foundation-panel .source-link').getAttribute('href'), 'https://github.com/joshcazalas/aws-foundation');
  await page.screenshot({ path: '.local/screenshots/outpost-ready.png' });

  await page.locator('#deploy-foundation').click();
  await page.waitForFunction(() => window.__factory.outpost.phase === 'blueprint');
  assert.equal((await state(page)).built, 0);
  assert(await page.locator('#deploy-foundation').isDisabled(), 'Do not overlap deployments');
  await page.waitForFunction(() => window.__factory.outpost.built > 0 && window.__factory.outpost.robots > 0);
  assert(!(await state(page)).powered, 'Construction must finish before connections activate');
  await page.locator('#pause').click();
  const stopped = await state(page);
  await page.waitForTimeout(400);
  assert.deepEqual(await state(page), stopped, 'Pause must freeze construction and bots');
  assert.match(await page.locator('#deployment-label').innerText(), /paused/);
  await page.screenshot({ path: '.local/screenshots/outpost-building.png' });
  await page.locator('#pause').click();

  // Observe the natural sequence once; no clock injection or manual completion.
  let prior = stopped.built;
  const deadline = Date.now() + 45000;
  while ((await state(page)).phase !== 'online') {
    assert(Date.now() < deadline, 'Construction must complete within the expected duration');
    await page.waitForTimeout(500);
    const current = await state(page);
    assert(current.built >= prior, 'A constructed part must persist');
    if (current.powered) assert.equal(current.built, current.total, 'Every part is present before production begins');
    prior = current.built;
  }
  const complete = await state(page);
  assert.equal(complete.built, complete.total);
  assert.equal(complete.robots, 0, 'Bots return to the depot');
  assert(complete.powered);
  await page.screenshot({ path: '.local/screenshots/outpost-online.png' });
  await page.locator('#deploy-foundation').click();
  await page.waitForFunction(() => window.__factory.outpost.phase === 'blueprint');
  assert.equal((await state(page)).built, 0, 'Replay resets the whole target, including power');
  assert(!(await state(page)).powered);
  await page.locator('#finish-deployment').click();
  await page.waitForFunction(() => window.__factory.outpost.phase === 'online');
  assert.equal((await state(page)).built, complete.total, 'Skip and natural completion produce the same build');
  await page.locator('#foundation-panel .project-details summary').click();
  assert(await page.locator('#foundation-panel .project-details').evaluate(e => e.open));
  assert.match(await page.locator('#foundation-panel .project-details').innerText(), /manual applies/);

  await page.goBack();
  await page.waitForFunction(() => window.__factory.destination === 'home');
  assert(!(await page.locator('#foundation-panel').isVisible()));
  await page.goForward();
  await page.waitForFunction(() => window.__factory.destination === 'aws-foundation');
  assert.equal((await state(page)).phase, 'online', 'Navigation preserves the existing site');
  await page.locator('#factory-canvas').focus();
  await page.keyboard.press('h');
  await page.waitForFunction(() => window.__factory.destination === 'home');
  assert.equal(new URL(page.url()).hash, '');
  console.log('Passed: directory, construction, pause, completed layout, replay, skip, readable content, history, and keyboard Home.');

  await page.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }); watch(mobile);
  await mobile.goto(new URL('#aws-foundation', base).href); await ready(mobile);
  await mobile.waitForTimeout(400);
  assert.equal(await mobile.evaluate(() => window.__factory.destination), 'aws-foundation', 'Direct project URL works on a fresh load');
  assert(await mobile.evaluate(() => window.__factory.paused));
  assert.equal((await state(mobile)).phase, 'ready');
  assert.match(await mobile.locator('#deploy-foundation').innerText(), /instantly/);
  await mobile.screenshot({ path: '.local/screenshots/outpost-mobile-ready.png' });
  await mobile.locator('#deploy-foundation').tap();
  await mobile.waitForFunction(() => window.__factory.outpost.phase === 'online');
  const still = await state(mobile);
  await mobile.waitForTimeout(300);
  assert.deepEqual(await state(mobile), still, 'Reduced motion builds instantly and stays still');
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth === innerWidth));
  for (const selector of ['#deploy-foundation', '#foundation-panel .source-link', '#foundation-panel .project-details summary', '.slot[data-go="home"]']) {
    const bounds = await mobile.locator(selector).boundingBox();
    assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844, `${selector} must fit on mobile`);
  }
  await mobile.screenshot({ path: '.local/screenshots/outpost-mobile-online.png' });
  await mobile.locator('#foundation-panel .project-details summary').tap();
  assert(await mobile.locator('#foundation-panel .project-details').evaluate(e => e.open));
  await mobile.locator('#foundation-panel .source-link').scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: '.local/screenshots/outpost-mobile-details.png' });
  await mobile.locator('.slot[data-go="home"]').tap();
  await mobile.waitForFunction(() => window.__factory.destination === 'home');
  assert(!(await mobile.locator('#foundation-panel').isVisible()));
  assert.deepEqual(errors, [], 'No rendering, asset loading, or browser errors');
  console.log('Passed: deep link, mobile layout, readable details, reduced motion, immediate completion, and return home.');
} finally { await browser.close(); }
