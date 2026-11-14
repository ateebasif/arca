/**
 * AI organize against REAL local Ollama models (optional; skipped if Ollama
 * or the models aren't installed). Starts a temporary `ollama serve` on port
 * 11435 that allows extension origins, so the user's own Ollama is untouched.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { launch, sleep } from './cdp';

const PORT = 11435;
const EMBED = 'nomic-embed-text:latest';
const CHAT = 'llama3.2:latest';

const TITLES: Array<[string, string]> = [
  [
    'Downie - YouTube Video Downloader for Mac',
    'https://software.charliemonroe.net/downie',
  ],
  ['Maccy: clipboard manager for macOS', 'https://github.com/p0deje/Maccy'],
  ['Must Have Apps for New MacBook', 'https://www.youtube.com/watch?v=1'],
  ['Wondershare Filmora for Mac', 'https://haxmac.cc/filmora'],
  [
    'React useEffect cleanup explained',
    'https://react.dev/learn/synchronizing-with-effects',
  ],
  ['Redux Toolkit vs Zustand', 'https://blog.logrocket.com/zustand'],
  ['React Native Bottom Sheet', 'https://gorhom.dev/react-native-bottom-sheet'],
  ['Next.js App Router caching', 'https://nextjs.org/docs/caching'],
  ['Thor Torrents - TorrentFunk', 'https://torrentfunk2.com/thor'],
  ['HINDI Movies Torrent Download', 'https://hindi-torrent.xyz/'],
  ['Download thor torrents - RARBG', 'https://rarbgmirror.com/thor'],
  ['AniRena Torrent List', 'https://www.anirena.com/'],
];

export async function runAiChecks(out: string): Promise<'skipped' | 'passed'> {
  const which = spawnSync('which', ['ollama']);
  if (which.status !== 0) return 'skipped';
  const server = spawn('ollama', ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST: `127.0.0.1:${PORT}`,
      OLLAMA_ORIGINS: 'chrome-extension://*',
    },
    stdio: 'ignore',
  });
  // Never leave the temporary Ollama running, even if the run is cut short.
  process.once('exit', () => server.kill());
  try {
    let tags: { models?: Array<{ name: string }> } = {};
    for (let i = 0; i < 40; i++) {
      try {
        tags = (await (
          await fetch(`http://127.0.0.1:${PORT}/api/tags`, {
            signal: AbortSignal.timeout(2000),
          })
        ).json()) as typeof tags;
        break;
      } catch {
        await sleep(250);
      }
    }
    const names = (tags.models ?? []).map((m) => m.name);
    if (!names.includes(EMBED) || !names.includes(CHAT)) return 'skipped';

    console.log('    … AI 0/4 temporary Ollama up; launching Chrome');
    const browser = await launch({ grantSiteAccess: true });
    try {
      const page = await browser.open('newtab.html');
      await page.setViewport(1280, 860, true);
      console.log('    … AI 0/4 seeding test bookmarks');
      const folder = await page.eval<string>(`(async () => {
        const f = await chrome.bookmarks.create({ parentId: '1', title: 'AI Lab' });
        for (const [title, url] of ${JSON.stringify(TITLES)}) await chrome.bookmarks.create({ parentId: f.id, title, url });
        return f.id;
      })()`);
      const settings = (url: string) =>
        page.eval(
          `chrome.storage.local.set({ settings: { aiEnabled: true, ollamaUrl: '${url}', embedModel: '${EMBED}', chatModel: '${CHAT}' } })`,
        );
      const openAi = async () => {
        await page.reload();
        await page.waitFor(`document.querySelector('[data-folder-id="1"]')`);
        await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
        await page.waitFor(`document.querySelector('[data-folder-card="${folder}"]')`);
        await page.eval(
          `document.querySelector('[data-folder-card="${folder}"]').click()`,
        );
        await page.waitFor(
          `document.querySelector('[aria-current=page]')?.textContent === 'AI Lab'`,
        );
        await page.eval(
          `[...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Tidy up')).click()`,
        );
        await page.waitFor(
          `[...document.querySelectorAll('[role=tab]')].some((t) => t.textContent === 'AI organize')`,
          8000,
        );
        await page.eval(
          `[...document.querySelectorAll('[role=tab]')].find((t) => t.textContent === 'AI organize').click()`,
        );
        await page.waitFor(
          `[...document.querySelectorAll('[role=dialog] button')].some((b) => b.textContent === 'Suggest folders')`,
        );
      };
      const suggest = () =>
        page.eval(
          `[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Suggest folders').click()`,
        );

      console.log('    … AI 1/4 setup help against your Ollama');
      // 1. The user's default Ollama (no extension origins) → clear help, not a crash.
      await settings('http://127.0.0.1:11434');
      await openAi();
      await suggest();
      await page.waitFor(`document.querySelector('[role=dialog] [role=alert]')`, 15000);
      const help = await page.eval<string>(
        `document.querySelector('[role=dialog] [role=alert]').textContent`,
      );
      const reachable = await fetch('http://127.0.0.1:11434/api/version').then(
        () => true,
        () => false,
      );
      if (reachable) assert.match(help, /OLLAMA_ORIGINS/, `help text: ${help}`);
      await page.screenshot(`${out}/ai-forbidden.png`);

      // Settings in a short window: the dialog scrolls instead of being cut off,
      // and Test connection reports the 403 even though listing models works.
      await page.key('Escape');
      await page.setViewport(1280, 640, true);
      await page.eval(
        `[...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Settings')).click()`,
      );
      await page.waitFor(
        `document.querySelector('[role=dialog]')?.textContent.includes('Local AI')`,
      );
      const fit = await page.eval<{ bottom: number; scrolls: boolean }>(`(() => {
        const d = document.querySelector('[role=dialog]');
        const body = d.children[1];
        return { bottom: d.getBoundingClientRect().bottom, scrolls: body.scrollHeight > body.clientHeight };
      })()`);
      assert.ok(
        fit.bottom <= 640,
        `settings dialog fits the window (bottom ${fit.bottom})`,
      );
      assert.ok(fit.scrolls, 'settings body scrolls');
      if (reachable) {
        await page.waitFor(
          `document.querySelector('[role=dialog] [role=alert]')?.textContent.includes('OLLAMA_ORIGINS')`,
          8000,
        );
        await page.eval(
          `document.querySelector('[role=dialog] [role=alert]').scrollIntoView({ block: 'center' })`,
        );
      }
      await sleep(300);
      await page.screenshot(`${out}/ai-settings-forbidden.png`);
      await page.key('Escape');
      await page.setViewport(1280, 860, true);

      console.log('    … AI 2/4 organize with the temporary Ollama');
      // 2. Temporary server that allows Arca → suggest, review, apply, undo.
      await settings(`http://127.0.0.1:${PORT}`);
      await openAi();
      await suggest();
      // Live progress (elapsed time, what's being read); best effort, since a
      // fast model can finish before we look.
      await page
        .waitFor(
          `document.querySelector('[role=dialog] [role=status]')?.textContent.includes('elapsed')`,
          3000,
        )
        .then(() => page.screenshot(`${out}/ai-running.png`))
        .catch(() => {});
      await page.waitFor(
        `document.querySelectorAll('[data-ai-group]').length >= 2`,
        120000,
      );
      const groups = await page.eval<string[]>(
        `[...document.querySelectorAll('[data-ai-group] input[aria-label="Folder name"]')].map((i) => i.value)`,
      );
      await sleep(300);
      await page.screenshot(`${out}/ai-review.png`);
      // Also tag links with their folder name.
      await page.eval(
        `[...document.querySelectorAll('[role=dialog] label')].find((l) => l.textContent.includes('Also tag links')).querySelector('input').click()`,
      );
      await page.eval(
        `[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.startsWith('Apply')).click()`,
      );
      await page.waitFor(
        `document.querySelector('[role=dialog]')?.textContent.includes('Organized by Arca')`,
        30000,
      );
      const tree = await page.eval<{
        root: number;
        folders: string[];
        left: number;
      }>(`(async () => {
        const [org] = await chrome.bookmarks.search({ title: 'Organized by Arca' });
        const folders = await chrome.bookmarks.getChildren(org.id);
        let root = 0;
        for (const f of folders) root += (await chrome.bookmarks.getChildren(f.id)).length;
        const left = (await chrome.bookmarks.getChildren('${folder}')).filter((n) => n.url).length;
        return { root, folders: folders.map((f) => f.title), left };
      })()`);
      assert.equal(tree.root, TITLES.length, 'every link moved into a topic folder');
      assert.equal(tree.left, 0);
      const tagged = await page.eval<number>(
        `chrome.storage.local.get('meta').then(({ meta }) => Object.values(meta ?? {}).filter((m) => m.tags?.length).length)`,
      );
      assert.equal(tagged, TITLES.length, 'every link tagged with its folder name');
      // Undo (⌘Z) puts everything back.
      await page.key('Escape');
      await page.key('z', 4);
      const count = `chrome.bookmarks.getChildren('${folder}').then((c) => c.filter((n) => n.url).length)`;
      let restored = 0;
      for (let i = 0; i < 100 && restored < TITLES.length; i++) {
        await sleep(100);
        restored = await page.eval<number>(count);
      }
      const leftover = await page.eval<number>(
        `chrome.bookmarks.search({ title: 'Organized by Arca' }).then((r) => r.length)`,
      );
      assert.equal(leftover, 0, 'undo removed the new folders');
      assert.equal(restored, TITLES.length, 'undo restored all links');
      console.log(
        `  ✓ AI organize with real Ollama: ${groups.length} folders (${groups.join(', ')}); undo restored all`,
      );

      console.log('    … AI 3/4 Ask Arca');
      // 3. Ask Arca: describe vaguely, get real bookmarks back.
      await page.key('Escape');
      await page.eval(
        `[...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Ask Arca')).click()`,
      );
      await page.waitFor(
        `document.querySelector('[role=dialog] input[aria-label="Ask Arca"]')`,
      );
      await page.eval(`(() => {
        const input = document.querySelector('[role=dialog] input[aria-label="Ask Arca"]');
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        set.call(input, 'I had some torrent sites saved but forgot where');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.form.requestSubmit();
      })()`);
      await page.waitFor(
        `document.querySelector('[data-ask-answer]') && !document.querySelector('[role=dialog]').textContent.includes('which fit best')`,
        120000,
      );
      const found = await page.eval<string[]>(
        `[...document.querySelectorAll('[data-ask-result]')].map((a) => a.getAttribute('href'))`,
      );
      assert.ok(
        found.some((h) => /torrent|rarbg|anirena/i.test(h)),
        `Ask Arca found torrent sites: ${found.join(', ')}`,
      );
      assert.ok(
        found.every((h) => /^https:/.test(h)),
        'only real web links',
      );
      await sleep(300);
      await page.screenshot(`${out}/ask-arca.png`);

      // Leaving the tab and coming back (same-tab result, then Back) keeps the chat.
      await page.reload();
      await page.waitFor(
        `document.querySelector('[role=dialog] [data-ask-answer]')`,
        10000,
      );
      const kept = await page.eval<number>(
        `document.querySelectorAll('[role=dialog] [data-ask-result]').length`,
      );
      assert.ok(kept > 0, 'chat restored after returning to the tab');
      console.log(
        `  ✓ Ask Arca with real Ollama: ${found.length} results (${found.join(', ')})`,
      );
      await page.key('Escape');

      console.log('    … AI 4/4 list descriptions');
      // 4. List view: one-line descriptions written by the local model.
      await page.key('Escape');
      await page.eval(`document.querySelector('[aria-label="List"]').click()`);
      await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
      await page.waitFor(`document.querySelector('[data-folder-id="${folder}"]')`);
      await page.eval(`document.querySelector('[data-folder-id="${folder}"]').click()`);
      await page.waitFor(
        `document.querySelectorAll('[data-description]').length >= 6`,
        90000,
      );
      const descriptions = await page.eval<string[]>(
        `[...document.querySelectorAll('[data-description]')].map((e) => e.textContent)`,
      );
      assert.ok(descriptions.every((d) => d.length > 3 && d.length <= 140));
      await sleep(300);
      await page.screenshot(`${out}/list-descriptions.png`);
      console.log(`  ✓ List descriptions with real Ollama: e.g. “${descriptions[0]}”`);
      await page.eval(`document.querySelector('[aria-label="Large tiles"]').click()`);
      await page.eval(`chrome.bookmarks.removeTree('${folder}')`);
    } finally {
      browser.close();
    }
    return 'passed';
  } finally {
    server.kill();
  }
}
