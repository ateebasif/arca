/**
 * Link-preview checks against a local test website (no internet needed).
 * Uses a test copy of the build with site access pre-granted.
 */
import assert from 'node:assert/strict';
import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { launch, sleep } from './cdp';

// 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64',
);

export async function runPreviewChecks(out: string): Promise<void> {
  const hits = new Map<string, number>();
  const headers: Record<string, IncomingHttpHeaders> = {};
  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]!;
    hits.set(path, (hits.get(path) ?? 0) + 1);
    headers[path] = req.headers;
    if (path === '/set-cookie') {
      res.writeHead(200, {
        'set-cookie': 'session=secret; Path=/',
        'content-type': 'text/html',
      });
      res.end('ok');
    } else if (path === '/page.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><head>
        <title>Fallback</title>
        <meta property="og:title" content="Arca test article">
        <meta property="og:description" content="A page served by the e2e test server.">
        <meta property="og:site_name" content="Test Site">
        <meta property="og:image" content="/cover.png">
      </head><body>
        <nav><p>Home · Blog · About · Contact · a navigation paragraph to ignore</p></nav>
        <article>
          <h1>Arca test article</h1>
          <p>This article is served by the local e2e server to check that previews show a readable excerpt.</p>
          <h2>Second section</h2>
          <p>It has a second paragraph so the card has enough text to scroll through when it is small.</p>
        </article>
      </body></html>`);
    } else if (path === '/evil.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><html><head>
        <meta property="og:title" content="<img src=x onerror=&quot;document.title='pwned'&quot;>">
        <meta property="og:image" content="/evil.svg">
        <script>parent.document.title = 'pwned'</script>
      </head><body><img src=x onerror="document.title='pwned'"></body></html>`);
    } else if (path === '/cover.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(PNG);
    } else if (path === '/evil.svg') {
      res.writeHead(200, { 'content-type': 'image/svg+xml' });
      res.end(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>`);
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const browser = await launch({ grantSiteAccess: true });

  try {
    // Give the browser a cookie for the site, to prove previews don't send it.
    const cookiePage = await browser.open(`${base}/set-cookie`);
    void cookiePage;

    const page = await browser.open('newtab.html');
    await page.setViewport(1280, 800);
    await page.eval(`(async () => {
      await chrome.bookmarks.create({ parentId: '1', title: 'Article', url: '${base}/page.html' });
      await chrome.bookmarks.create({ parentId: '1', title: 'Hostile page', url: '${base}/evil.html' });
      await chrome.storage.local.set({ settings: { linkPreviews: true } });
    })()`);
    await page.reload();
    await page.waitFor('document.querySelector("[data-bookmark-id]")');
    const selectorFor = (title: string) =>
      page.eval<string>(
        `'[data-bookmark-id="' + [...document.querySelectorAll('[data-bookmark-id]')].find((a) => a.textContent.includes(${JSON.stringify(title)})).dataset.bookmarkId + '"]'`,
      );

    // 1. Hover → preview card with re-encoded image.
    const article = await selectorFor('Article');
    await page.hover(article);
    await page.waitFor(
      `document.querySelector('[data-testid=link-preview]')?.textContent.includes('Arca test article')`,
      10000,
    );
    await page.waitFor(`document.querySelector('[data-testid=link-preview] img')`);
    const src = await page.eval<string>(
      `document.querySelector('[data-testid=link-preview] img').src`,
    );
    assert.ok(src.startsWith('data:image/webp;base64,'), `image src ${src.slice(0, 40)}`);
    // Screenshot via keyboard focus: CDP's capture synthesizes a pointer-out,
    // which (correctly) closes a mouse-opened card but not a focused one.
    await page.hover(null);
    await page.waitFor(`!document.querySelector('[data-testid=link-preview]')`);
    await page.eval(`document.querySelector('${article.replace(/'/g, "\\'")}').focus()`);
    await page.waitFor(`document.querySelector('[data-testid=link-preview] img')`);
    await page.screenshot(`${out}/link-preview.png`);
    assert.ok(
      await page.eval(`!!document.querySelector('[data-testid=link-preview]')`),
      'focused preview closed by an unrelated pointer event',
    );
    await page.eval('document.activeElement.blur()');

    // 1b. Excerpt + headings, and the card stays open when the pointer moves into it.
    const cardText = await page.eval<string>(
      `document.querySelector('[data-testid=link-preview]').textContent`,
    );
    assert.match(cardText, /readable excerpt/);
    assert.match(cardText, /Second section/);
    assert.doesNotMatch(cardText, /navigation paragraph/);
    await page.hover('[data-testid=link-preview] [data-preview-scroll]');
    await sleep(500);
    assert.ok(
      await page.eval(`!!document.querySelector('[data-testid=link-preview]')`),
      'card closed when moving into it',
    );

    // 2. No cookies or referrer sent to the site.
    assert.equal(headers['/page.html']?.cookie, undefined, 'preview sent cookies');
    assert.equal(headers['/page.html']?.referer, undefined, 'preview sent a referrer');
    assert.equal(headers['/cover.png']?.cookie, undefined, 'image request sent cookies');

    // 3. Cached: hover again, and after a reload (IndexedDB) → no new fetch.
    await page.hover(null);
    await page.waitFor(`!document.querySelector('[data-testid=link-preview]')`);
    await page.hover(article);
    await page.waitFor(
      `document.querySelector('[data-testid=link-preview]')?.textContent.includes('Arca test article')`,
    );
    await page.reload();
    await page.waitFor('document.querySelector("[data-bookmark-id]")');
    await page.hover(await selectorFor('Article'));
    await page.waitFor(
      `document.querySelector('[data-testid=link-preview]')?.textContent.includes('Arca test article')`,
    );
    assert.equal(
      hits.get('/page.html'),
      1,
      `page fetched ${hits.get('/page.html')} times`,
    );
    assert.equal(
      hits.get('/cover.png'),
      1,
      `image fetched ${hits.get('/cover.png')} times`,
    );

    // 4. Hostile page: markup stays text, scripts never run, SVG refused.
    //    (Wait for the open card to close first; it can cover the next tile.)
    await page.hover(null);
    await page.waitFor(`!document.querySelector('[data-testid=link-preview]')`);
    await page.hover(await selectorFor('Hostile page'));
    await page.waitFor(
      `document.querySelector('[data-testid=link-preview]')?.textContent.includes('<img src=x')`,
      10000,
    );
    await sleep(300);
    assert.equal(await page.eval('document.title'), 'New Tab');
    assert.equal(
      await page.eval(`!!document.querySelector('[data-testid=link-preview] img')`),
      false,
    );
    assert.deepEqual(page.consoleErrors, [], 'console errors');
    console.log(
      `  ✓ link previews: rendered, no cookies/referrer, cached (page hits: ${hits.get('/page.html')}), hostile page inert`,
    );
  } finally {
    browser.close();
    server.close();
  }
}
