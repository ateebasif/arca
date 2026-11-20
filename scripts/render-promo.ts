/**
 * Renders the Chrome Web Store small promo tile (440×280) from the Arca icon
 * with headless Chrome: `bun run build && bun scripts/render-promo.ts`.
 * Output: docs/store/promo-small-440x280.png
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { launch, sleep } from './e2e/cdp';

const OUT = 'docs/store/promo-small-440x280.png';
const icon = readFileSync('assets/icon/arca.svg', 'utf8');
const iconUrl = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:440px;height:280px;overflow:hidden}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#fff;
    background:radial-gradient(120% 120% at 0% 0%,#7b6cff 0%,#5a4ae0 45%,#2b2170 100%);
    display:flex;align-items:center;gap:24px;padding:0 36px;box-sizing:border-box}
  img{width:112px;height:112px;filter:drop-shadow(0 10px 24px rgba(0,0,0,.35))}
  h1{margin:0;font-size:46px;letter-spacing:-.02em;font-weight:700}
  p{margin:6px 0 0;font-size:17px;line-height:1.35;opacity:.92;max-width:220px}
</style></head><body>
  <img src="${iconUrl}" alt="">
  <div><h1>Arca</h1><p>Your bookmarks as a fast, private dashboard</p></div>
</body></html>`;

const browser = await launch();
try {
  const page = await browser.open('about:blank');
  await page.setViewport(440, 280, true);
  await page.navigate(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  await sleep(400);
  await page.screenshot(OUT);
  spawnSync('sips', ['-z', '280', '440', OUT], { stdio: 'ignore' });
  console.log(`Saved ${OUT}`);
} finally {
  await browser.close();
}
