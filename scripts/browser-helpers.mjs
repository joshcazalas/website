/** Enter through the same Play/loading flow as a visitor before checking the map. */
export async function enterFactory(page) {
  await page.locator('#play-factory').click();
  await page.waitForFunction(() => window.__factory?.entered, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#entry-screen').hidden);
}
