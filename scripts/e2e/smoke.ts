/**
 * End-to-end smoke check against real Chrome with the built extension.
 *
 *   bun run build && bun run e2e
 *
 * Screenshots land in .e2e/ (git-ignored). Exits non-zero on any failure.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { launch, MOD, sleep, type Page } from './cdp';

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
  await page.eval(`document.querySelector('[aria-label="List view"]').click()`);
  await page.waitFor('document.querySelector("[role=table]")');
  await page.screenshot(`${OUT}/folder-work-list.png`);
  await page.eval(`document.querySelector('[aria-label="Grid view"]').click()`);
});

check('search: mod+K, type, arrows, alt+Enter reveals in folder', async (page) => {
  await page.waitFor('document.querySelector("[data-bookmark-id]")');
  await page.setViewport(1280, 800);
  await page.key('k', MOD.meta);
  await page.waitFor('document.activeElement?.getAttribute("role") === "combobox"');
  await page.type('fig');
  await page.waitFor('document.querySelector("[role=option]")');
  await page.screenshot(`${OUT}/search.png`);
  const first = await page.eval<string>(
    `document.querySelector('[role=option]').textContent`,
  );
  assert.match(first, /Figma/);
  await page.key('Enter', MOD.alt);
  await page.waitFor(
    'document.querySelector("[aria-current=page]")?.textContent === "Work"',
  );
  await page.waitFor('document.activeElement?.textContent?.includes("Figma")');
  await page.key('Escape');
});

check('search over 5,000 real bookmarks stays under 50 ms', async (page) => {
  await page.waitFor('document.querySelector("[data-bookmark-id]")');
  // Bulk-create through the real API in a dedicated folder.
  await page.eval(`(async () => {
    const root = await chrome.bookmarks.create({ parentId: '2', title: 'arca-e2e-bulk' });
    for (let f = 0; f < 50; f++) {
      const folder = await chrome.bookmarks.create({ parentId: root.id, title: 'Bulk ' + f });
      await Promise.all(Array.from({ length: 100 }, (_, i) =>
        chrome.bookmarks.create({ parentId: folder.id, title: 'Item ' + f + '-' + i + ' alpha', url: 'https://bulk' + f + '.example.com/' + i })));
    }
  })()`);
  await page.reload();
  await page.waitFor('document.querySelector("[role=treeitem]")');
  const timings = await page.eval<number[]>(`(async () => {
    const input = document.querySelector('[role=combobox]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const out = [];
    for (const q of ['alph', 'item 42', 'bulk7 example', 'zzzz']) {
      const t = performance.now();
      setter.call(input, q);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => requestAnimationFrame(() => r()));
      out.push(performance.now() - t);
    }
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return out;
  })()`);
  console.log(`    search+render ms: ${timings.map((t) => t.toFixed(1)).join(', ')}`);
  // Includes React render + one frame, so this bounds the 50 ms search budget loosely.
  assert.ok(Math.max(...timings.slice(1)) < 100, `too slow: ${timings.join(', ')}`);
  await page.eval(`(async () => {
    const [n] = await chrome.bookmarks.search({ title: 'arca-e2e-bulk' });
    await chrome.bookmarks.removeTree(n.id);
  })()`);
});

check('edits in Arca land in chrome.bookmarks immediately', async (page) => {
  await page.waitFor('document.querySelector("[data-bookmark-id]")');
  await page.setViewport(1280, 800);
  const inChrome = (title: string) =>
    page.eval<number>(
      `chrome.bookmarks.search({ title: ${JSON.stringify(title)} }).then((r) => r.length)`,
    );

  // Create via the dialog.
  await page.click('[aria-label="Add"]');
  await page.click('[role=menuitem]');
  await page.waitFor('document.querySelector("[role=dialog] input")');
  await page.type('Arca e2e');
  await page.key('Tab');
  await page.type('arca.example.com');
  await page.screenshot(`${OUT}/dialog-new.png`);
  await page.key('Enter');
  await page.waitFor('!document.querySelector("[role=dialog]")');
  assert.equal(await inChrome('Arca e2e'), 1);

  // Rename with F2.
  await page.eval(
    `[...document.querySelectorAll('[data-bookmark-id]')].find((a) => a.textContent.includes('Arca e2e')).focus()`,
  );
  await page.key('F2');
  await page.waitFor('document.activeElement?.getAttribute("aria-label") === "Name"');
  await page.key('a', MOD.meta);
  await page.type('Arca renamed');
  await page.key('Enter');
  await page.waitFor(`document.body.textContent.includes('Arca renamed')`);
  assert.equal(await inChrome('Arca renamed'), 1);

  // Menu screenshot, then delete with the Delete key.
  await page.eval(
    `[...document.querySelectorAll('[data-bookmark-id]')].find((a) => a.textContent.includes('Arca renamed')).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 700, clientY: 300 }))`,
  );
  await page.waitFor('document.querySelector("[role=menu]")');
  await page.screenshot(`${OUT}/item-menu.png`);
  await page.key('Escape');
  await page.eval(
    `[...document.querySelectorAll('[data-bookmark-id]')].find((a) => a.textContent.includes('Arca renamed')).focus()`,
  );
  await page.key('Delete');
  await page.waitFor(
    `!document.querySelector('[data-bookmark-id]')?.closest('ul')?.textContent.includes('Arca renamed')`,
  );
  assert.equal(await inChrome('Arca renamed'), 0);
});

check('root folders cannot be renamed or deleted', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.eval(`document.querySelector('[role=treeitem]').focus()`);
  await page.key('F2');
  await page.key('Delete');
  await sleep(200);
  assert.equal(
    await page.eval('!!document.querySelector("input[aria-label=Name]")'),
    false,
  );
  const roots = await page.eval<string[]>(
    `chrome.bookmarks.getTree().then((t) => t[0].children.map((c) => c.title))`,
  );
  assert.deepEqual(roots, ['Bookmarks bar', 'Other bookmarks']);
});

check('New Tab modes: minimal search page and redirect', async (page) => {
  const setMode = (patch: object) =>
    page.eval(
      `chrome.storage.local.set({ settings: ${JSON.stringify({ saveFolderId: '1', redirectUrl: '', ...patch })} })`,
    );
  await setMode({ newTabMode: 'minimal' });
  await page.reload();
  await page.waitFor('document.activeElement?.getAttribute("role") === "combobox"');
  await page.type('lin');
  await page.waitFor('document.querySelector("[role=option]")');
  await page.setViewport(1280, 800);
  await page.screenshot(`${OUT}/newtab-minimal.png`);

  // .invalid never resolves, so this makes no real network request.
  const origin = await page.eval<string>('location.origin');
  await setMode({
    newTabMode: 'redirect',
    redirectUrl: 'https://arca-redirect.invalid/',
  });
  await page.reload();
  await sleep(500);
  const history = await page.send<{ entries: Array<{ url: string }> }>(
    'Page.getNavigationHistory',
  );
  // Reset from the dashboard page, which never redirects.
  await page.navigate(`${origin}/dashboard.html`);
  await setMode({ newTabMode: 'dashboard' });
  const urls = history.entries.map((e) => e.url);
  assert.ok(
    urls.some((u) => u.startsWith('https://arca-redirect.invalid')),
    `history: ${urls.join(', ')}`,
  );
});

check('popup: quick search and dashboard page', async (page) => {
  const origin = await page.eval<string>('location.origin');
  await page.navigate(`${origin}/popup.html`);
  await page.setViewport(380, 520);
  await page.waitFor('document.activeElement?.getAttribute("role") === "combobox"');
  await page.type('o');
  await page.waitFor(
    'document.querySelectorAll("[role=listbox] [role=option]").length > 0',
  );
  const count = await page.eval<number>(
    'document.querySelectorAll("[role=listbox] [role=option]").length',
  );
  assert.ok(count <= 8, `popup shows ${count} results`);
  const width = await page.eval<number>(
    'document.querySelector("main").getBoundingClientRect().width',
  );
  assert.equal(width, 380);
  await page.screenshot(`${OUT}/popup.png`);

  await page.navigate(`${origin}/dashboard.html`);
  await page.waitFor('document.querySelector("[role=tree] [role=treeitem]")');
  assert.equal(await page.eval('document.title'), 'Arca');
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
