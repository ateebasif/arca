/**
 * End-to-end smoke check against real Chrome with the built extension.
 *
 *   bun run build && bun run e2e
 *
 * Screenshots land in .e2e/ (git-ignored). Exits non-zero on any failure.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, type Page } from './cdp';

const OUT = '.e2e';
mkdirSync(OUT, { recursive: true });

const checks: Array<[string, (page: Page) => Promise<void>]> = [];
const check = (name: string, fn: (page: Page) => Promise<void>) =>
  checks.push([name, fn]);

check('new tab renders without errors', async (page) => {
  await page.waitFor('document.querySelector("h1")');
  await page.setViewport(1200, 760);
  await page.screenshot(`${OUT}/newtab-light.png`);
  await page.setViewport(1200, 760, true);
  await page.screenshot(`${OUT}/newtab-dark.png`);
});

check('chrome move semantics match the test fake', async (page) => {
  const result = await page.eval<{ order: string; eventIndex: number }>(`(async () => {
    const bm = chrome.bookmarks;
    const folder = await bm.create({ parentId: '2', title: 'arca-e2e-move' });
    const ids = [];
    for (const t of ['A', 'B', 'C', 'D']) {
      ids.push((await bm.create({ parentId: folder.id, title: t, url: 'https://' + t + '.dev/' })).id);
    }
    let eventIndex = -1;
    const listener = (_id, info) => { eventIndex = info.index; };
    bm.onMoved.addListener(listener);
    await bm.move(ids[0], { parentId: folder.id, index: 2 });
    await new Promise((r) => setTimeout(r, 50));
    bm.onMoved.removeListener(listener);
    const order = (await bm.getChildren(folder.id)).map((n) => n.title).join('');
    await bm.removeTree(folder.id);
    return { order, eventIndex };
  })()`);
  assert.deepEqual(result, { order: 'BACD', eventIndex: 1 });
});

const browser = await launch();
let failed = 0;
try {
  for (const [name, fn] of checks) {
    const page = await browser.open('newtab.html');
    try {
      await fn(page);
      assert.deepEqual(page.consoleErrors, [], 'console errors');
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failed++;
      console.error(`  ✗ ${name}\n    ${error instanceof Error ? error.message : error}`);
      await page
        .screenshot(`${OUT}/failed-${name.replace(/\W+/g, '-')}.png`)
        .catch(() => {});
    }
  }
} finally {
  browser.close();
}
console.log(failed ? `\n${failed} failed` : `\nall ${checks.length} passed`);
process.exit(failed ? 1 : 0);
