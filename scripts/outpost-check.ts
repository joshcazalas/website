import { enterFactory as ready } from './browser-helpers.ts';
import { chromium, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

await mkdir('.local/screenshots', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
const base = process.env.TEST_URL || 'http://127.0.0.1:5173/';
const errors: string[] = [];
const watch = (page: Page) => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
};
const state = (page: Page) => page.evaluate(() => window.__factory.outpost);
const repoUrl = 'https://github.com/joshcazalas/aws-foundation';
const mapRepo = `.world-link[href="${repoUrl}"]`;
const checkRepoTab = async (page: Page, activate: () => Promise<unknown>) => {
  // Verify the real anchor/new-tab behavior without loading the external site.
  await page.context().route(repoUrl, route => route.fulfill({ contentType: 'text/html', body: '<title>Repository</title>' }));
  const opened = page.waitForEvent('popup');
  await activate();
  const tab = await opened;
  await tab.waitForURL(repoUrl);
  await tab.close();
  await page.bringToFront();
  assert.equal(await page.evaluate(() => window.__factory.destination), 'aws-foundation');
};

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } }); watch(page);
  await page.goto(base); await ready(page);
  await page.locator('.slot[data-go="aws-foundation"]').click();
  await page.waitForTimeout(1000);
  assert.equal(new URL(page.url()).hash, '#aws-foundation');
  assert(await page.locator('#foundation-panel').isVisible());
  assert.equal((await state(page)).phase, 'ready');
  assert.equal((await state(page)).built, 0);
  assert.equal(await page.locator('#foundation-panel .source-link').getAttribute('href'), 'https://github.com/joshcazalas/aws-foundation');
  await page.screenshot({ path: '.local/screenshots/outpost-ready.png' });
  const repo = page.locator(mapRepo);
  assert(await repo.isVisible(), 'Pixel repository link is visible in the desktop outpost');
  assert.equal(await repo.getAttribute('target'), '_blank');
  const initialLink = await repo.boundingBox();
  await page.mouse.move(600, 700);await page.mouse.down();await page.mouse.move(660, 735, { steps: 8 });await page.mouse.up();
  await page.waitForTimeout(400);
  const pannedLink = await repo.boundingBox();
  assert(initialLink && pannedLink, 'Repository link remains visible after panning');
  assert(pannedLink.x > initialLink.x + 40, 'Repository link follows camera panning');
  await page.mouse.move(450, 300);await page.mouse.wheel(0, -120);await page.waitForTimeout(900);
  const zoomedLink = await repo.boundingBox();
  assert(zoomedLink, 'Repository link remains visible after zooming');
  assert(zoomedLink.width > pannedLink.width * 1.1, 'Repository hit area scales with map zoom');
  await repo.hover();await page.screenshot({ path: '.local/screenshots/outpost-repo-link.png' });
  await checkRepoTab(page, () => repo.click());
  await page.locator('#foundation-panel [data-go="aws-foundation"]').click();await page.waitForTimeout(900);
  await repo.focus();await checkRepoTab(page, () => page.keyboard.press('Enter'));

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
  assert(await page.locator('#foundation-panel .project-details').evaluate(e => e instanceof HTMLDetailsElement && e.open));
  assert.match(await page.locator('#foundation-panel .project-details').innerText(), /infrastructure as code/);

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
  console.log('Passed: quickbar, construction, pause, completed layout, replay, skip, readable content, history, and keyboard Home.');

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
  // The mobile camera frames the construction site; pan west to its nameplate link.
  for (let i = 0; i < 2; i++) {
    await mobile.mouse.move(70, 180);await mobile.mouse.down();await mobile.mouse.move(320, 240, { steps: 8 });await mobile.mouse.up();
  }
  await mobile.waitForTimeout(300);
  assert(await mobile.locator(mapRepo).isVisible());
  await checkRepoTab(mobile, () => mobile.locator(mapRepo).tap());
  await mobile.locator('#foundation-panel [data-go="aws-foundation"]').tap();
  await mobile.locator('#foundation-panel .project-details summary').tap();
  assert(await mobile.locator('#foundation-panel .project-details').evaluate(e => e instanceof HTMLDetailsElement && e.open));
  await mobile.locator('#foundation-panel .source-link').scrollIntoViewIfNeeded();
  await mobile.screenshot({ path: '.local/screenshots/outpost-mobile-details.png' });
  await mobile.locator('.slot[data-go="home"]').tap();
  await mobile.waitForFunction(() => window.__factory.destination === 'home');
  assert(!(await mobile.locator('#foundation-panel').isVisible()));
  assert.deepEqual(errors, [], 'No rendering, asset loading, or browser errors');
  console.log('Passed: deep link, mobile layout, pixel GitHub link with pan/zoom and keyboard/touch activation, readable details, reduced motion, immediate completion, and return home.');
} finally { await browser.close(); }
