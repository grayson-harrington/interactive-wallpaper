// Renders public/thumbs/<id>.png for the Daily Minimal grid.
//   npm run serve  (in another terminal), then npm run thumbs, then npm run build
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:4747';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 1 });
await page.goto(`${BASE}/?follow=0&ui=0&mode=ambient`);
await page.waitForFunction(() => window.__wallpaper);
const keys = (await page.evaluate(() => window.__wallpaper.keys())).filter((k) => k.startsWith('dm:'));
for (const key of keys) {
  const sub = key.slice(3);
  await page.evaluate((s) => window.__wallpaper.show({ id: 'daily-minimal', sub: s }), sub);
  await page.waitForTimeout(sub === 'S02-474' ? 1500 : 3500);
  await page.screenshot({ path: `public/thumbs/${sub}.png` });
  console.log('thumb', sub);
}
await browser.close();
