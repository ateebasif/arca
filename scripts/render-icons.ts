/**
 * Renders the extension icons from assets/icon/*.svg with headless Chrome
 * (no image tooling needed). Re-run after editing the SVGs:
 *
 *   bun run build && bun scripts/render-icons.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { launch } from './e2e/cdp';

const SIZES = [16, 32, 48, 96, 128] as const;
// Chrome's guideline: the 128px icon is a 96px image with 16px transparent padding.
const artSize = (size: number) => (size === 128 ? 96 : size);
const svgFor = (size: number) =>
  readFileSync(
    size <= 16 ? 'assets/icon/arca-small.svg' : 'assets/icon/arca.svg',
    'utf8',
  );

const browser = await launch();
try {
  const page = await browser.open('about:blank');
  await page.send('Emulation.setDefaultBackgroundColorOverride', {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });
  for (const size of SIZES) {
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: size,
      height: size,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgFor(size)).toString('base64')}`;
    await page.eval(`(async () => {
      document.documentElement.style.cssText = 'margin:0;background:transparent';
      document.body.style.cssText = 'margin:0;background:transparent';
      document.body.replaceChildren();
      const img = new Image(${artSize(size)}, ${artSize(size)});
      img.style.cssText = 'display:block;margin:${(size - artSize(size)) / 2}px';
      img.src = ${JSON.stringify(dataUrl)};
      document.body.append(img);
      await img.decode();
    })()`);
    const { data } = await page.send<{ data: string }>('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: size, height: size, scale: 1 },
    });
    writeFileSync(`public/icon/${size}.png`, Buffer.from(data, 'base64'));
    console.log(`public/icon/${size}.png`);
  }
} finally {
  browser.close();
}
