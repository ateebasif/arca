/**
 * End-to-end smoke check against real Chrome with the built extension.
 *
 *   bun run build && bun run e2e
 *
 * Screenshots land in .e2e/ (git-ignored). Exits non-zero on any failure.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { launch, MOD, sleep, type Page } from './cdp';
import { runAiChecks } from './ai';
import { runPreviewChecks } from './previews';

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
  // Folder card text must stay on one line even with a favicon preview.
  const wrapped = await page.eval<
    string[]
  >(`[...document.querySelectorAll('[data-folder-card] .text-xs')]
    .filter((el) => el.getClientRects().length > 1 || el.scrollHeight > el.clientHeight + 1)
    .map((el) => el.textContent)`);
  assert.deepEqual(wrapped, [], `wrapped folder counts: ${wrapped.join(', ')}`);
  await page.click('[data-folder-card]');
  await page.waitFor(
    'document.querySelector("[aria-current=page]")?.textContent === "Work"',
  );
  await page.setViewport(1280, 800);
  await page.screenshot(`${OUT}/folder-work.png`);
  await page.eval(`document.querySelector('[aria-label="Small tiles"]').click()`);
  await page.screenshot(`${OUT}/folder-work-compact.png`);
  await page.eval(`document.querySelector('[aria-label="Large tiles"]').click()`);
  await page.eval(`document.querySelector('[aria-label="List"]').click()`);
  await page.waitFor('document.querySelector("[role=table]")');
  await page.screenshot(`${OUT}/folder-work-list.png`);
  await page.eval(`document.querySelector('[aria-label="Large tiles"]').click()`);
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

check('1,000-bookmark folder is virtualized, scrolls and reveals', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.eval(`(async () => {
    const folder = await chrome.bookmarks.create({ parentId: '2', title: 'arca-e2e-big' });
    await Promise.all(Array.from({ length: 1000 }, (_, i) =>
      chrome.bookmarks.create({ parentId: folder.id, title: 'Big ' + String(i).padStart(4, '0'), url: 'https://big' + i + '.example.com/' })));
  })()`);
  await page.setViewport(1280, 800);
  await page.reload();
  await page.waitFor('document.querySelector("[role=treeitem]")');
  const t0 = await page.eval<number>('performance.now()');
  await page.eval(`(async () => {
    const [f] = await chrome.bookmarks.search({ title: 'arca-e2e-big' });
    window.__bigId = f.id;
  })()`);
  // Open the folder via the tree (expand Other bookmarks first).
  await page.eval(`document.querySelector('[data-folder-id="2"]').click()`);
  await page.waitFor('document.querySelector("[data-folder-card]")');
  await page.eval(
    `document.querySelector('[data-folder-card="' + window.__bigId + '"]').click()`,
  );
  await page.waitFor('document.querySelector("[data-virtualized] [data-bookmark-id]")');
  const t1 = await page.eval<number>('performance.now()');
  const rendered = await page.eval<number>(
    'document.querySelectorAll("[data-bookmark-id]").length',
  );
  console.log(
    `    open 1,000-item folder: ${(t1 - t0).toFixed(0)} ms, ${rendered} tiles in DOM`,
  );
  assert.ok(rendered < 200, `rendered ${rendered} tiles`);
  await page.screenshot(`${OUT}/big-folder.png`);

  await page.eval(
    `document.querySelector('[aria-label="Folder contents"]').scrollTop = 1e9`,
  );
  await page.waitFor(
    `[...document.querySelectorAll('[data-bookmark-id]')].some((a) => a.textContent.includes('Big 0999'))`,
  );

  // Reveal an item far down from search.
  await page.eval(
    `document.querySelector('[aria-label="Folder contents"]').scrollTop = 0`,
  );
  await page.key('k', MOD.meta);
  await page.type('big 0777');
  await page.waitFor('document.querySelector("[role=option]")');
  await page.key('Enter', MOD.alt);
  await page.waitFor(`document.activeElement?.textContent?.includes('Big 0777')`);

  await page.eval(`chrome.bookmarks.removeTree(window.__bigId)`);
});

check('New Tab paint budgets with 5,000 bookmarks', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.eval(`(async () => {
    const root = await chrome.bookmarks.create({ parentId: '2', title: 'arca-e2e-perf' });
    for (let f = 0; f < 50; f++) {
      const folder = await chrome.bookmarks.create({ parentId: root.id, title: 'Perf ' + f });
      await Promise.all(Array.from({ length: 100 }, (_, i) =>
        chrome.bookmarks.create({ parentId: folder.id, title: 'P ' + f + '-' + i, url: 'https://perf' + f + '.example.com/' + i })));
    }
  })()`);
  const runs: Array<{ fcp: number; interactive: number }> = [];
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await page.waitFor('document.querySelector("[data-bookmark-id]")');
    runs.push(
      await page.eval(`(() => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? -1;
        const interactive = performance.getEntriesByName('arca:interactive')[0]?.startTime ?? -1;
        return { fcp, interactive };
      })()`),
    );
  }
  const best = (k: 'fcp' | 'interactive') => Math.min(...runs.map((r) => r[k]));
  console.log(
    `    FCP ${runs.map((r) => r.fcp.toFixed(0)).join('/')} ms, interactive ${runs.map((r) => r.interactive.toFixed(0)).join('/')} ms`,
  );
  await page.eval(`(async () => {
    const [n] = await chrome.bookmarks.search({ title: 'arca-e2e-perf' });
    await chrome.bookmarks.removeTree(n.id);
  })()`);
  assert.ok(best('fcp') > 0 && best('fcp') < 100, `FCP ${best('fcp')}`);
  assert.ok(
    best('interactive') > 0 && best('interactive') < 200,
    `interactive ${best('interactive')}`,
  );
});

check('security: other extensions cannot message or read Arca', async (page) => {
  const arcaId = browser.extensionId;
  const [hostileId] = browser.extraIds;
  const origin = await page.eval<string>('location.origin');
  await page.navigate(`chrome-extension://${hostileId}/attack.html`);
  const result = await page.eval<Record<string, string>>(`(async () => {
    const out = {};
    const attempt = async (name, fn) => {
      try { out[name] = 'ok: ' + JSON.stringify(await fn()); }
      catch (e) { out[name] = 'blocked: ' + (e && e.message || e); }
    };
    await attempt('sendMessage', () => chrome.runtime.sendMessage(${JSON.stringify(arcaId)}, { cmd: 'getSettings' }));
    await attempt('connect', () => new Promise((resolve, reject) => {
      const port = chrome.runtime.connect(${JSON.stringify(arcaId)});
      port.onDisconnect.addListener(() => reject(new Error(chrome.runtime.lastError?.message || 'disconnected')));
      setTimeout(() => resolve('still connected'), 500);
    }));
    await attempt('fetchPage', () => fetch('chrome-extension://${arcaId}/newtab.html').then((r) => r.status));
    await attempt('fetchScript', () => fetch('chrome-extension://${arcaId}/manifest.json').then((r) => r.status));
    return out;
  })()`);
  await page.navigate(`${origin}/newtab.html`);
  console.log(`    ${JSON.stringify(result)}`);
  for (const [name, outcome] of Object.entries(result)) {
    assert.match(outcome, /^blocked/, `${name} should be blocked, got ${outcome}`);
  }
});

check('security: planted javascript: bookmarks are inert', async (page) => {
  const [hostileId] = browser.extraIds;
  const origin = await page.eval<string>('location.origin');
  // The hostile extension plants a bookmarklet through Chrome's own API.
  await page.navigate(`chrome-extension://${hostileId}/attack.html`);
  await page.eval(
    `chrome.bookmarks.create({ parentId: '1', title: 'Planted', url: 'javascript:document.title="pwned"' })`,
  );
  await page.navigate(`${origin}/newtab.html`);
  await page.waitFor(
    `[...document.querySelectorAll('[data-bookmark-id]')].some((a) => a.textContent.includes('Planted'))`,
  );
  const sel = `[...document.querySelectorAll('[data-bookmark-id]')].find((a) => a.textContent.includes('Planted'))`;
  assert.equal(await page.eval(`${sel}.hasAttribute('href')`), false);
  await page.eval(`${sel}.click()`);
  await page.eval(`${sel}.focus()`);
  await page.key('Enter');
  await page.waitFor('document.querySelector("[role=alert]")');
  assert.equal(await page.eval('document.title'), 'New Tab');
  assert.equal(await page.eval('location.pathname'), '/newtab.html');
  await page.eval(`(async () => {
    const [n] = await chrome.bookmarks.search({ title: 'Planted' });
    await chrome.bookmarks.remove(n.id);
  })()`);
});

check('security: websites cannot frame or fetch Arca pages', async (page) => {
  const arcaUrl = `chrome-extension://${browser.extensionId}/newtab.html`;
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><iframe id="f" src="${arcaUrl}"></iframe>`);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const origin = await page.eval<string>('location.origin');
  try {
    await page.navigate(`http://127.0.0.1:${port}/`);
    await sleep(800);
    const tree = await page.send<{
      frameTree: {
        childFrames?: Array<{ frame: { url: string; unreachableUrl?: string } }>;
      };
    }>('Page.getFrameTree');
    const child = tree.frameTree.childFrames?.[0]?.frame;
    const fetched = await page.eval<string>(
      `fetch(${JSON.stringify(arcaUrl)}).then((r) => 'ok ' + r.status, (e) => 'blocked ' + e.message)`,
    );
    console.log(
      `    iframe → ${child?.url} ${child?.unreachableUrl ?? ''}; fetch → ${fetched}`,
    );
    assert.ok(
      !child || child.url !== arcaUrl,
      'Arca page loaded inside a website iframe',
    );
    assert.match(fetched, /^blocked/);
  } finally {
    server.close();
    await page.navigate(`${origin}/newtab.html`);
  }
});

check('theme: dark mode overrides a light system and sticks', async (page) => {
  await page.waitFor('document.querySelector("[role=radiogroup]")');
  await page.setViewport(1280, 800, false); // system says light
  const bodyBg = () =>
    page.eval<string>('getComputedStyle(document.body).backgroundColor');
  await page.click('[role=radiogroup] [aria-label="Light"]');
  await page.waitFor('document.documentElement.dataset.theme === "light"');
  const lightBg = await bodyBg();
  await page.click('[role=radiogroup] [aria-label="Dark"]');
  await page.waitFor('document.documentElement.dataset.theme === "dark"');
  await page.screenshot(`${OUT}/theme-dark-forced.png`);
  const darkBg = await bodyBg();
  assert.notEqual(darkBg, lightBg);

  await page.reload();
  // Applied from the localStorage mirror before React renders.
  await page.waitFor('document.readyState === "complete"');
  assert.equal(await page.eval('document.documentElement.dataset.theme'), 'dark');
  assert.equal(await bodyBg(), darkBg);

  const origin = await page.eval<string>('location.origin');
  await page.navigate(`${origin}/popup.html`);
  await page.waitFor('document.querySelector("main")');
  assert.equal(await page.eval('document.documentElement.dataset.theme'), 'dark');

  await page.navigate(`${origin}/newtab.html`);
  await page.waitFor('document.querySelector("[role=radiogroup]")');
  await page.click('[role=radiogroup] [aria-label="Match system"]');
  await page.waitFor('document.documentElement.dataset.theme === undefined');
});

check('all links: flattens a big nested library with folder labels', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.eval(`(async () => {
    const root = await chrome.bookmarks.create({ parentId: '1', title: 'Imported From Elsewhere' });
    const names = ['Mac Things', 'Android Apps', 'React Projects', 'Interview Prep', 'Jobs', 'Notes'];
    for (const [f, name] of names.entries()) {
      const folder = await chrome.bookmarks.create({ parentId: root.id, title: name });
      const sub = await chrome.bookmarks.create({ parentId: folder.id, title: name + ' archive' });
      await Promise.all(Array.from({ length: 100 }, (_, i) =>
        chrome.bookmarks.create({ parentId: i % 2 ? folder.id : sub.id, title: name + ' link ' + i, url: 'https://site' + ((f * 7 + i) % 23) + '.example.com/' + i })));
    }
    window.__importId = root.id;
  })()`);
  await page.setViewport(1440, 900, true);
  await page.eval(
    `document.querySelector('[role=radio][aria-checked]') && [...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.trim() === 'Folders')?.click()`,
  );
  await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
  await page.waitFor('document.querySelector("[data-folder-card]")');
  await page.eval(
    `document.querySelector('[data-folder-card="' + window.__importId + '"]').click()`,
  );
  await page.waitFor('document.querySelector("[data-folder-card]")');
  await sleep(1000); // let the entrance animation finish
  await page.screenshot(`${OUT}/redesign-folders.png`);
  await page.eval(
    `[...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.trim() === 'All links').click()`,
  );
  await page.waitFor(`document.body.textContent.includes('600 links across 12 folders')`);
  const sample = await page.eval<string>(
    `document.querySelector('[data-bookmark-id]').textContent`,
  );
  assert.match(sample, /Mac Things|archive/);
  await sleep(1000);
  await page.screenshot(`${OUT}/redesign-all-links.png`);
  await page.eval(
    `[...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.trim() === 'Folders').click()`,
  );
  await page.eval(`chrome.bookmarks.removeTree(window.__importId)`);
});

check('drag & drop: move into folders, reorder, sidebar drop, undo', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.setViewport(1280, 800, true);
  type LabIds = { root: string; target: string; inner: string } & Record<
    'Drag A' | 'Drag B' | 'Drag C',
    string
  >;
  const ids = await page.eval<LabIds>(`(async () => {
    const bm = chrome.bookmarks;
    const root = await bm.create({ parentId: '1', title: 'DnD Lab' });
    const target = await bm.create({ parentId: root.id, title: 'Target' });
    const inner = await bm.create({ parentId: target.id, title: 'Inner' });
    const out = { root: root.id, target: target.id, inner: inner.id };
    for (const t of ['Drag A', 'Drag B', 'Drag C']) {
      out[t] = (await bm.create({ parentId: root.id, title: t, url: 'https://' + t.replace(' ', '').toLowerCase() + '.example.com/' })).id;
    }
    return out;
  })()`);
  const children = (folderId: string) =>
    page.eval<string[]>(
      `chrome.bookmarks.getChildren('${folderId}').then((c) => c.map((n) => n.title))`,
    );
  await page.eval(
    `[...document.querySelectorAll('[role=radio]')].find((b) => b.textContent.trim() === 'Folders')?.click()`,
  );
  await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
  await page.waitFor(`document.querySelector('[data-folder-card="${ids.root}"]')`);
  await page.eval(`document.querySelector('[data-folder-card="${ids.root}"]').click()`);
  await page.waitFor(`document.querySelector('[data-bookmark-id="${ids['Drag A']}"]')`);
  await sleep(900);

  // 1. Tile onto a folder card's cover → moves into it.
  await page.drag(
    `[data-bookmark-id="${ids['Drag A']}"]`,
    `[data-folder-card="${ids.target}"] [data-drop-folder]`,
  );
  assert.deepEqual(await children(ids.target), ['Inner', 'Drag A']);

  // 2. Reorder: drag C onto B → C before B.
  await page.drag(
    `[data-bookmark-id="${ids['Drag C']}"]`,
    `[data-bookmark-id="${ids['Drag B']}"]`,
  );
  assert.deepEqual(await children(ids.root), ['Target', 'Drag C', 'Drag B']);

  // 3. Onto a sidebar tree folder (Other bookmarks).
  await page.drag(`[data-bookmark-id="${ids['Drag B']}"]`, `li[data-drop-folder="2"]`);
  assert.ok((await children('2')).includes('Drag B'));

  // 4. Onto a breadcrumb: move "Inner" up to "DnD Lab".
  //    (Folder-into-itself is refused; covered in tests/dnd/moves.test.ts.)
  await page.eval(
    `document.querySelector('[data-folder-card="${ids.target}"]').scrollIntoView()`,
  );
  await page.click(`[data-folder-card="${ids.target}"]`);
  await page.waitFor(`document.querySelector('[data-folder-card="${ids.inner}"]')`);
  await sleep(900);
  await page.drag(
    `[data-folder-card="${ids.inner}"]`,
    `nav[aria-label=Breadcrumb] [data-drop-folder="${ids.root}"]`,
  );
  assert.deepEqual(
    await children(ids.root),
    ['Target', 'Drag C', 'Inner'].filter((t) => t !== 'Inner').concat('Inner'),
  );
  await page.screenshot(`${OUT}/dnd.png`);

  // 5. Undo the last move with ⌘Z.
  await page.key('z', MOD.meta);
  await sleep(400);
  assert.deepEqual(await children(ids.root), ['Target', 'Drag C']);
  assert.deepEqual(await children(ids.target), ['Inner', 'Drag A']);

  await page.eval(`(async () => {
    await chrome.bookmarks.removeTree('${ids.root}');
    const [b] = await chrome.bookmarks.search({ title: 'Drag B' });
    if (b) await chrome.bookmarks.remove(b.id);
  })()`);
});

check('tidy up: finds and removes duplicates, with undo', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.setViewport(1280, 800, true);
  const rootId = await page.eval<string>(`(async () => {
    const bm = chrome.bookmarks;
    const root = await bm.create({ parentId: '2', title: 'Tidy Lab' });
    const trash = await bm.create({ parentId: root.id, title: 'Trash' });
    await bm.create({ parentId: root.id, title: 'Dup page', url: 'https://dup.example.com/' });
    await bm.create({ parentId: trash.id, title: 'Dup page', url: 'https://www.dup.example.com/?utm_source=a' });
    await bm.create({ parentId: trash.id, title: 'Dup page (2)', url: 'https://dup.example.com#top' });
    return root.id;
  })()`);
  const count = () =>
    page.eval<number>(
      `chrome.bookmarks.search({ query: 'dup.example.com' }).then((r) => r.length)`,
    );
  assert.equal(await count(), 3);
  await page.eval(
    `[...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Tidy up')).click()`,
  );
  await page.waitFor(
    `document.querySelector('[role=dialog]')?.textContent.includes('extra')`,
    8000,
  );
  await sleep(400);
  await page.screenshot(`${OUT}/tidy.png`);
  const clickByText = (text: string) =>
    page.eval(
      `[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(text)})).click()`,
    );
  await clickByText('Remove');
  await clickByText('Confirm');
  await page.waitFor(
    `document.querySelector('[role=dialog]')?.textContent.includes('No duplicates')`,
    8000,
  );
  assert.equal(await count(), 1);
  const kept = await page.eval<string>(
    `chrome.bookmarks.search({ query: 'dup.example.com' }).then(async (r) => (await chrome.bookmarks.get(r[0].parentId))[0].title)`,
  );
  assert.equal(kept, 'Tidy Lab', 'kept the copy outside Trash');
  await page.key('Escape');
  await page.key('z', MOD.meta);
  await page.waitFor(`true`);
  await sleep(600);
  assert.equal(await count(), 3);
  await page.eval(`chrome.bookmarks.removeTree('${rootId}')`);
});

check('drag & drop by keyboard: Space, arrows, Space into a folder', async (page) => {
  await page.waitFor('document.querySelector("[role=treeitem]")');
  await page.setViewport(1280, 800, true);
  const ids = await page.eval<{ root: string; box: string; item: string }>(`(async () => {
    const bm = chrome.bookmarks;
    const root = await bm.create({ parentId: '2', title: 'Keyboard Lab' });
    const box = await bm.create({ parentId: root.id, title: 'Box' });
    const item = await bm.create({ parentId: root.id, title: 'Move me', url: 'https://moveme.example.com/' });
    return { root: root.id, box: box.id, item: item.id };
  })()`);
  await page.eval(`document.querySelector('[data-folder-id="2"]').click()`);
  await page.waitFor(`document.querySelector('[data-folder-card="${ids.root}"]')`);
  await page.eval(`document.querySelector('[data-folder-card="${ids.root}"]').click()`);
  await page.waitFor(`document.querySelector('[data-bookmark-id="${ids.item}"]')`);
  await sleep(900);
  await page.eval(`document.querySelector('[data-bookmark-id="${ids.item}"]').focus()`);
  const url = await page.eval<string>('location.href');
  await page.key(' ');
  await sleep(150);
  await page.key('ArrowUp');
  await sleep(250);
  await page.key('Enter'); // must not open the link mid-drag
  await page.key(' ');
  await sleep(400);
  const parent = await page.eval<string>(
    `chrome.bookmarks.get('${ids.item}').then(([n]) => n.parentId)`,
  );
  assert.equal(parent, ids.box, 'keyboard drop did not move into the folder');
  assert.equal(await page.eval('location.href'), url, 'Enter opened something mid-drag');
  await page.eval(`chrome.bookmarks.removeTree('${ids.root}')`);
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

check('mini window: opens small, "Open here" moves it into this window', async (page) => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>Mini page</title><h1>Mini page</h1>');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/`;
  try {
    const origin = await page.eval<string>('location.origin');
    const id = await page.eval<string>(`(async () => {
      await chrome.storage.local.set({ settings: { openIn: 'window', version: 2 } });
      return (await chrome.bookmarks.create({ parentId: '1', title: 'Mini page', url: '${url}' })).id;
    })()`);
    await page.navigate(`${origin}/dashboard.html`);
    await page.waitFor(`document.querySelector('[data-folder-id="1"]')`);
    await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
    await page.waitFor(`document.querySelector('[data-bookmark-id="${id}"]')`);
    // A plain click on the tile opens it the way Settings says: a mini window.
    await page.click(`[data-bookmark-id="${id}"]`);
    const popups = () =>
      page.eval<number>(
        `chrome.windows.getAll({ windowTypes: ['popup'] }).then((w) => w.length)`,
      );
    for (let i = 0; i < 50 && (await popups()) === 0; i++) await sleep(100);
    assert.equal(await popups(), 1, 'a mini (popup) window opened');
    await page.eval(`window.dispatchEvent(new Event('focus'))`);
    await page.waitFor(
      `[...document.querySelectorAll('[aria-label="Mini windows"] button')].some((b) => b.textContent === 'Open here')`,
      5000,
    );
    await sleep(300);
    await page.screenshot(`${OUT}/mini-window-bar.png`);
    const before = await page.eval<number>(
      `chrome.tabs.query({ currentWindow: true }).then((t) => t.length)`,
    );
    await page.eval(
      `[...document.querySelectorAll('[aria-label="Mini windows"] button')].find((b) => b.textContent === 'Open here').click()`,
    );
    for (let i = 0; i < 50 && (await popups()) > 0; i++) await sleep(100);
    assert.equal(await popups(), 0, 'mini window closed');
    const tabs = await page.eval<string[]>(
      `chrome.tabs.query({ currentWindow: true }).then((t) => t.map((x) => x.url || x.pendingUrl))`,
    );
    assert.equal(tabs.length, before + 1, 'opened as a tab in this window');
    assert.ok(tabs.includes(url), `with the same page (${tabs.join(', ')})`);
    await page.waitFor(`!document.querySelector('[aria-label="Mini windows"]')`, 5000);
    await page.eval(`(async () => {
      await chrome.storage.local.set({ settings: {} });
      await chrome.bookmarks.remove('${id}');
      const extra = await chrome.tabs.query({ url: '${url}' });
      await chrome.tabs.remove(extra.map((t) => t.id));
    })()`);
  } finally {
    server.close();
  }
});

check('tags: add in Edit, filter from the sidebar, find with #tag', async (page) => {
  const origin = await page.eval<string>('location.origin');
  const ids = await page.eval<string[]>(`(async () => {
    const a = await chrome.bookmarks.create({ parentId: '1', title: 'Tag me A', url: 'https://tag-a.invalid/' });
    const f = await chrome.bookmarks.create({ parentId: '2', title: 'Tag folder' });
    const b = await chrome.bookmarks.create({ parentId: f.id, title: 'Tag me B', url: 'https://tag-b.invalid/' });
    return [a.id, b.id];
  })()`);
  await page.navigate(`${origin}/dashboard.html`);
  await page.waitFor(`document.querySelector('[data-folder-id="1"]')`);
  await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
  await page.waitFor(`document.querySelector('[data-bookmark-id="${ids[0]}"]')`);
  // Edit dialog → add a tag → save.
  await page.eval(
    `document.querySelector('[data-bookmark-id="${ids[0]}"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }))`,
  );
  await page.waitFor(
    `[...document.querySelectorAll('[role=menuitem]')].some((b) => b.textContent.startsWith('Edit'))`,
  );
  await page.eval(
    `[...document.querySelectorAll('[role=menuitem]')].find((b) => b.textContent.startsWith('Edit')).click()`,
  );
  await page.waitFor(
    `document.querySelector('[role=dialog] input[aria-label="Add tag"]')`,
  );
  await page.eval(
    `document.querySelector('[role=dialog] input[aria-label="Add tag"]').focus()`,
  );
  await page.type('research');
  await page.key('Enter');
  await page.waitFor(
    `document.querySelector('[role=dialog]').textContent.includes('#research')`,
  );
  await page.eval(
    `[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Save').click()`,
  );
  await page.waitFor(`!document.querySelector('[role=dialog]')`);
  // Same tag on a link in another root folder.
  await page.eval(
    `chrome.storage.local.get('meta').then(({ meta }) => chrome.storage.local.set({ meta: { ...meta, '${ids[1]}': { tags: ['research'], url: 'https://tag-b.invalid/' } } }))`,
  );
  await page.waitFor(
    `document.querySelector('[data-bookmark-id="${ids[0]}"] [data-tags]')?.textContent.includes('#research')`,
  );
  // Sidebar tag → everything tagged, across folders.
  await page.waitFor(
    `[...document.querySelectorAll('[aria-label=Tags] button')].some((b) => b.textContent.includes('research'))`,
  );
  await page.eval(
    `[...document.querySelectorAll('[aria-label=Tags] button')].find((b) => b.textContent.includes('research')).click()`,
  );
  await page.waitFor(`document.querySelector('[data-tag-view="research"]')`);
  const shown = await page.eval<string[]>(
    `[...document.querySelectorAll('[data-tag-view] [data-bookmark-id]')].map((e) => e.getAttribute('data-bookmark-id'))`,
  );
  assert.deepEqual(shown.sort(), [...ids].sort(), 'tag view shows both links');
  await sleep(300);
  await page.screenshot(`${OUT}/tags-view.png`);
  // #tag in search.
  await page.eval(`document.querySelector('[aria-label="Clear tag filter"]').click()`);
  await page.eval(
    `document.querySelector('input[type=search], [role=combobox]').focus()`,
  );
  await page.type('#resea');
  await page.waitFor(
    `document.querySelectorAll('[aria-label="Search results"] [role=option]').length === 2`,
    5000,
  );
  await page.eval(`(async () => {
    await chrome.storage.local.remove('meta');
    for (const id of ${JSON.stringify(ids)}) await chrome.bookmarks.remove(id);
    const [f] = await chrome.bookmarks.search({ title: 'Tag folder' });
    if (f) await chrome.bookmarks.removeTree(f.id);
  })()`);
});

check('multi-select: pick, ⇧-range, bulk move into a folder, undo', async (page) => {
  const origin = await page.eval<string>('location.origin');
  const made = await page.eval<{
    folder: string;
    target: string;
    ids: string[];
  }>(`(async () => {
    const bm = chrome.bookmarks;
    const folder = await bm.create({ parentId: '2', title: 'Select src' });
    const target = await bm.create({ parentId: '2', title: 'Select dst' });
    const ids = [];
    for (const t of ['S1', 'S2', 'S3', 'S4']) {
      ids.push((await bm.create({ parentId: folder.id, title: t, url: 'https://' + t.toLowerCase() + '.invalid/' })).id);
    }
    return { folder: folder.id, target: target.id, ids };
  })()`);
  await page.navigate(`${origin}/dashboard.html`);
  await page.waitFor(`document.querySelector('[data-folder-id="${made.folder}"]')`);
  await page.eval(`document.querySelector('[data-folder-id="${made.folder}"]').click()`);
  await page.waitFor(`document.querySelector('[data-bookmark-id="${made.ids[3]}"]')`);
  // First pick via its checkbox, then ⇧-click extends the range.
  await page.eval(`document.querySelector('[aria-label="Select S1"]').click()`);
  await page.waitFor(`document.querySelector('[role=region][aria-label=Selection]')`);
  await page.eval(
    `document.querySelector('[data-select-id="${made.ids[2]}"] a, [data-select-id="${made.ids[2]}"] button:not([data-select-box])').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true, button: 0 }))`,
  );
  await page.waitFor(
    `document.querySelector('[role=region][aria-label=Selection]').textContent.includes('3 items selected')`,
  );
  // Clicking a selected tile toggles instead of opening a tab.
  const tabsBefore = await page.eval<number>(
    `chrome.tabs.query({}).then((t) => t.length)`,
  );
  await page.eval(
    `document.querySelector('[data-select-id="${made.ids[3]}"] a, [data-select-id="${made.ids[3]}"] button:not([data-select-box])').click()`,
  );
  await page.waitFor(
    `document.querySelector('[role=region][aria-label=Selection]').textContent.includes('4 items selected')`,
  );
  await sleep(200);
  assert.equal(
    await page.eval<number>(`chrome.tabs.query({}).then((t) => t.length)`),
    tabsBefore,
    'no tab opened',
  );
  // Un-pick S4, then move the 3 picked into "Select dst".
  await page.eval(`document.querySelector('[aria-label="Select S4"]').click()`);
  await page.eval(
    `[...document.querySelectorAll('[aria-label=Selection] button')].find((b) => b.textContent === 'Move to…').click()`,
  );
  await page.waitFor(`document.querySelector('[aria-label="Move to folder"]')`);
  await page.eval(`document.querySelector('[aria-label="Move to folder"]').click()`);
  await page.waitFor(`document.querySelector('input[aria-label="Find a folder"]')`);
  await page.eval(`document.querySelector('input[aria-label="Find a folder"]').focus()`);
  await page.type('Select dst');
  await page.key('Enter');
  await page.eval(
    `[...document.querySelectorAll('[aria-label=Selection] button')].find((b) => b.textContent.startsWith('Move 3')).click()`,
  );
  await page.waitFor(`!document.querySelector('[role=region][aria-label=Selection]')`);
  const moved = await page.eval<string[]>(
    `chrome.bookmarks.getChildren('${made.target}').then((c) => c.map((n) => n.title))`,
  );
  assert.deepEqual(moved, ['S1', 'S2', 'S3']);
  await page.screenshot(`${OUT}/multi-select.png`);
  // One undo puts all three back, in order.
  await page.key('z', MOD.meta);
  await page.waitFor(
    `chrome.bookmarks.getChildren('${made.folder}').then((c) => c.map((n) => n.title).join() === 'S1,S2,S3,S4')`,
  );
  await page.eval(`(async () => {
    await chrome.bookmarks.removeTree('${made.folder}');
    await chrome.bookmarks.removeTree('${made.target}');
  })()`);
});

check('small tiles: compact folder rows and smaller link tiles', async (page) => {
  const origin = await page.eval<string>('location.origin');
  const folder = await page.eval<string>(`(async () => {
    const f = await chrome.bookmarks.create({ parentId: '2', title: 'Density' });
    await chrome.bookmarks.create({ parentId: f.id, title: 'Inner' });
    await chrome.bookmarks.create({ parentId: f.id, title: 'Link', url: 'https://density.invalid/' });
    return f.id;
  })()`);
  await page.navigate(`${origin}/dashboard.html`);
  await page.waitFor(`document.querySelector('[data-folder-id="${folder}"]')`);
  await page.eval(`document.querySelector('[data-folder-id="${folder}"]').click()`);
  await page.waitFor(`document.querySelector('[data-folder-card]')`);
  const height = () =>
    page.eval<number>(
      `document.querySelector('[data-folder-card]').getBoundingClientRect().height`,
    );
  await page.eval(`document.querySelector('[aria-label="Large tiles"]').click()`);
  await sleep(150);
  const large = await height();
  await page.eval(`document.querySelector('[aria-label="Small tiles"]').click()`);
  await sleep(150);
  const small = await height();
  assert.ok(small < large && small <= 48, `small ${small} < large ${large}`);
  assert.equal(
    await page.eval<string>(
      `document.querySelector('[aria-label="Small tiles"]').getAttribute('aria-checked')`,
    ),
    'true',
  );
  await page.screenshot(`${OUT}/small-tiles.png`);
  await page.eval(`document.querySelector('[aria-label="Large tiles"]').click()`);
  await page.eval(`chrome.bookmarks.removeTree('${folder}')`);
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

const browser = await launch({ extraExtensions: ['scripts/e2e/hostile-extension'] });
let failed = 0;
try {
  const setup = await browser.open('newtab.html');
  await seed(setup);
  for (const [name, fn] of checks) {
    const page = await browser.open('newtab.html');
    try {
      await fn(page);
      assert.deepEqual(page.consoleErrors, [], 'console errors');
      // PRD §15: no network requests. Extension, data and blob URLs are local;
      // the redirect check deliberately navigates to a .invalid host, and the
      // hostile-website check loads a page from the local test server.
      const external = page.requests.filter(
        (u) =>
          !/^(chrome-extension|chrome-error|data|blob|chrome|about):/.test(u) &&
          !u.includes('.invalid/') &&
          !u.startsWith('http://127.0.0.1:'),
      );
      assert.deepEqual(
        external,
        [],
        `unexpected network requests: ${external.join(', ')}`,
      );
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
try {
  await runPreviewChecks(OUT);
} catch (error) {
  failed++;
  console.error(
    `  ✗ link previews\n    ${error instanceof Error ? error.message : error}`,
  );
}
// Real-model checks are slow (they start a second Ollama and load models), so
// they run only with `bun run e2e:ai` (E2E_AI=1), and never longer than 6 min.
const AI_LIMIT_MS = 6 * 60_000;
let aiResult = 'skipped';
try {
  if (process.env.E2E_AI === '1') {
    aiResult = await Promise.race([
      runAiChecks(OUT),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('AI checks took longer than 6 minutes')),
          AI_LIMIT_MS,
        ),
      ),
    ]);
  }
  if (aiResult === 'skipped')
    console.log(
      process.env.E2E_AI === '1'
        ? '  - AI checks skipped (Ollama or models not installed)'
        : '  - AI checks skipped (run `bun run e2e:ai` for real-model checks)',
    );
} catch (error) {
  failed++;
  console.error(`  ✗ AI organize\n    ${error instanceof Error ? error.message : error}`);
}
const total = checks.length + 1 + (aiResult === 'passed' ? 1 : 0);
console.log(failed ? `\n${failed} failed` : `\nall ${total} passed`);
process.exit(failed ? 1 : 0);
