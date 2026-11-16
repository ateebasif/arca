/**
 * Captures the README screenshots from the built extension with a sample
 * library (no real data): `bun run build && bun scripts/screenshots.ts`.
 * Images go to docs/screenshots/. With `--store`, Chrome Web Store
 * screenshots (exactly 1280×800) go to docs/store/ instead.
 */
import { spawnSync } from 'node:child_process';
import { launch, sleep, type Page } from './e2e/cdp';

const STORE = process.argv.includes('--store');
const OUT = STORE ? 'docs/store' : 'docs/screenshots';
let storeIndex = 0;

const LIBRARY = {
  bar: [
    {
      t: 'Design',
      c: [
        ['Figma', 'https://www.figma.com/', ['design', 'tool']],
        ['Dribbble', 'https://dribbble.com/', ['inspiration']],
        ['Coolors palette generator', 'https://coolors.co/', ['design', 'color']],
        ['Refactoring UI', 'https://www.refactoringui.com/', ['design', 'book']],
      ],
    },
    {
      t: 'Dev',
      c: [
        ['React documentation', 'https://react.dev/', ['react', 'docs']],
        ['MDN Web Docs', 'https://developer.mozilla.org/', ['docs']],
        [
          'TypeScript Handbook',
          'https://www.typescriptlang.org/docs/',
          ['typescript', 'docs'],
        ],
        ['Tailwind CSS', 'https://tailwindcss.com/', ['css', 'docs']],
        ['Vite', 'https://vite.dev/', ['tool']],
      ],
    },
    {
      t: 'Reading',
      c: [
        ['How to Do Great Work', 'https://paulgraham.com/greatwork.html', ['essay']],
        ['The Pragmatic Engineer', 'https://newsletter.pragmaticengineer.com/', []],
        ['Hacker News', 'https://news.ycombinator.com/', []],
      ],
    },
    {
      t: 'Travel',
      c: [
        ['Lisbon in 3 days', 'https://www.lonelyplanet.com/portugal/lisbon', ['travel']],
        ['Google Flights', 'https://www.google.com/travel/flights', ['travel', 'tool']],
      ],
    },
    ['GitHub', 'https://github.com/', ['dev']],
    ['YouTube', 'https://www.youtube.com/', []],
    ['Linear', 'https://linear.app/', ['tool']],
    ['Notion', 'https://www.notion.so/', ['tool']],
  ],
  other: [
    {
      t: 'Recipes',
      c: [
        [
          'Serious Eats: pizza dough',
          'https://www.seriouseats.com/pizza-dough',
          ['cooking'],
        ],
        ['Bon Appétit ramen', 'https://www.bonappetit.com/ramen', ['cooking']],
      ],
    },
  ],
};

async function seed(page: Page) {
  await page.eval(`(async () => {
    const lib = ${JSON.stringify(LIBRARY)};
    const meta = {};
    const add = async (parentId, items) => {
      for (const it of items) {
        if (Array.isArray(it)) {
          const n = await chrome.bookmarks.create({ parentId, title: it[0], url: it[1] });
          if (it[2].length) meta[n.id] = { tags: it[2], url: it[1] };
        } else {
          const f = await chrome.bookmarks.create({ parentId, title: it.t });
          await add(f.id, it.c);
        }
      }
    };
    await add('1', lib.bar);
    await add('2', lib.other);
    await chrome.storage.local.set({ meta });
  })()`);
}

const browser = await launch();
try {
  const page = await browser.open('newtab.html');
  await seed(page);
  const shot = async (name: string, width = 1280, height = 800, dark = true) => {
    // The store wants exactly 1280×800 (captured at 2×, then scaled down).
    await page.setViewport(STORE ? 1280 : width, STORE ? 800 : height, dark);
    await sleep(400);
    const file = STORE
      ? `${OUT}/screenshot-${++storeIndex}-${name}.png`
      : `${OUT}/${name}.png`;
    await page.screenshot(file);
    if (STORE) spawnSync('sips', ['-z', '800', '1280', file], { stdio: 'ignore' });
  };
  const openFolder = async (title: string) => {
    await page.eval(
      `[...document.querySelectorAll('[data-folder-card]')].find((b) => b.getAttribute('aria-label').startsWith(${JSON.stringify(title)})).click()`,
    );
    await sleep(300);
  };

  await page.reload();
  await page.waitFor(`document.querySelector('[data-folder-id="1"]')`);
  await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
  await page.waitFor(`document.querySelector('[data-folder-card]')`);
  await shot('dashboard');
  if (STORE) {
    await page.eval(`document.querySelector('[aria-label="Arca: go to Home"]').click()`);
    await shot('home');
    await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
    await page.waitFor(`document.querySelector('[data-folder-card]')`);
  }

  // List view with tags, light theme.
  await openFolder('Dev');
  await page.eval(`document.querySelector('[aria-label="List"]').click()`);
  await page.eval(
    `[...document.querySelectorAll('button')].find((b) => b.title === 'Light' || b.getAttribute('aria-label') === 'Light')?.click()`,
  );
  await shot('list-light', 1280, 800, false);
  await page.eval(
    `[...document.querySelectorAll('button')].find((b) => b.title === 'Dark' || b.getAttribute('aria-label') === 'Dark')?.click()`,
  );
  await page.eval(`document.querySelector('[aria-label="Large tiles"]').click()`);

  // Search.
  await page.eval(
    `document.querySelector('input[aria-label="Search bookmarks"]').focus()`,
  );
  await page.type('docs');
  await sleep(300);
  await shot('search');
  await page.key('Escape');

  // AI organize panel with instructions (no model call is made).
  await page.eval(
    `chrome.storage.local.get('settings').then(({ settings }) => chrome.storage.local.set({ settings: { ...settings, aiEnabled: true, embedModel: 'nomic-embed-text:latest', chatModel: 'llama3.2:latest' } }))`,
  );
  await page.reload();
  await page.waitFor(`document.querySelector('[data-folder-id="1"]')`);
  await page.eval(`document.querySelector('[data-folder-id="1"]').click()`);
  await sleep(300);
  await page.eval(
    `[...document.querySelectorAll('aside button')].find((b) => b.textContent.includes('Tidy up')).click()`,
  );
  await page.waitFor(
    `[...document.querySelectorAll('[role=tab]')].some((t) => t.textContent === 'AI organize')`,
  );
  await page.eval(
    `[...document.querySelectorAll('[role=tab]')].find((t) => t.textContent === 'AI organize').click()`,
  );
  await page.waitFor(
    `[...document.querySelectorAll('summary')].some((s) => s.textContent.includes('Instructions'))`,
  );
  await page.eval(
    `[...document.querySelectorAll('summary')].find((s) => s.textContent.includes('Instructions')).click()`,
  );
  await shot('ai-organize', 1280, 900);
  console.log(`Saved screenshots to ${OUT}/`);
} finally {
  await browser.close();
}
