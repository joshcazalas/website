import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, type Page } from '@playwright/test';
/** Enter through the same Play/loading flow as a visitor before checking the map. */
export async function enterFactory(page: Page) {
  await page.locator('#play-factory').click();
  await page.waitForFunction(() => window.__factory?.entered, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector<HTMLElement>('#entry-screen')?.hidden);
}

export async function launchOutpostBrowser() {
  await mkdir('.local/screenshots', { recursive: true });
  return chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
}

export const testBase = process.env.TEST_URL || 'http://127.0.0.1:5173/';

export function watchPageErrors(page: Page, errors: string[]) {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
}

export async function checkRepositoryTab(page: Page, repoUrl: string, destination: string, activate: () => Promise<unknown>) {
  await page.context().route(repoUrl, route => route.fulfill({
    contentType: 'text/html', body: '<title>Repository</title>',
  }), { times: 1 });
  const opened = page.waitForEvent('popup');
  await activate();
  const tab = await opened;
  await tab.waitForURL(repoUrl);
  await tab.close();
  await page.bringToFront();
  assert.equal(await page.evaluate(() => window.__factory.destination), destination);
}
