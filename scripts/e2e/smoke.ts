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

check('new tab renders the folder tree without errors', async (page) => {
  await page.waitFor('document.querySelector("[role=tree] [role=treeitem]")');
  const items = await page.eval<string[]>(
    `[...document.querySelectorAll('[role=treeitem]')].map((el) => el.textContent)`,
  );
  assert.ok(
    items.some((t) => t.startsWith('Work')),
    `tree items: ${items.join(', ')}`,
  );
  await page.setViewport(1280, 800);
  await page.screenshot(`${OUT}/newtab-light.png`);
  await page.setViewport(1280, 800, true);
  await page.screenshot(`${OUT}/newtab-dark.png`);
});

check('grid shows folder cards and tiles; folders open on click', async (page) => {
  await page.waitFor('document.querySelector("[data-bookmark-id]")');
  // Fresh profile: no favicons cached, so tiles should show letters, not globes.
  await page.waitFor(
    'document.querySelectorAll("[data-testid=letter-tile]").length >= 2',
  );
  await page.click('[data-folder-card]');
  await page.waitFor(
    'document.querySelector("[aria-current=page]")?.textContent === "Work"',
  );
  await page.setViewport(1280, 800);
  await page.screenshot(`${OUT}/folder-work.png`);
  await page.eval(`document.querySelector('[aria-label="Compact density"]').click()`);
  await page.screenshot(`${OUT}/folder-work-compact.png`);
  await page.eval(`document.querySelector('[aria-label="Comfortable density"]').click()`);
});

check('tree follows bookmark changes made outside Arca', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.eval(`chrome.bookmarks.create({ parentId: '1', title: 'Made elsewhere' })`);
  await page.waitFor(
    `[...document.querySelectorAll('[role=treeitem]')].some((el) => el.textContent.startsWith('Made elsewhere'))`,
  );
  await page.eval(`(async () => {
    const [n] = await chrome.bookmarks.search({ title: 'Made elsewhere' });
    await chrome.bookmarks.remove(n.id);
  })()`);
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

/** Seeds a realistic bookmark tree once, through the real API. */
async function seed(page: Page) {
  await page.eval(`(async () => {
    const bm = chrome.bookmarks;
    const add = async (parentId, items) => {
      for (const item of items) {
        const node = await bm.create({ parentId, title: item.t, url: item.u });
        if (item.c) await add(node.id, item.c);
      }
    };
    await add('1', [
      { t: 'GitHub', u: 'https://github.com/' },
      { t: 'Work', c: [
        { t: 'Linear', u: 'https://linear.app/' },
        { t: 'Figma', u: 'https://www.figma.com/' },
        { t: 'Docs', c: [{ t: 'MDN', u: 'https://developer.mozilla.org/' }] },
      ] },
      { t: 'Reading', c: [
        { t: 'Hacker News', u: 'https://news.ycombinator.com/' },
        { t: 'The Verge', u: 'https://www.theverge.com/' },
      ] },
      { t: 'YouTube', u: 'https://www.youtube.com/' },
    ]);
    await add('2', [{ t: 'Recipes', c: [{ t: 'Serious Eats', u: 'https://www.seriouseats.com/' }] }]);
  })()`);
}

const browser = await launch();
let failed = 0;
try {
  const setup = await browser.open('newtab.html');
  await seed(setup);
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
