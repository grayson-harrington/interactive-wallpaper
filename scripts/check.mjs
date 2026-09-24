// Smoke test: load every piece in headless Chromium, collect console errors,
// take a screenshot of each, and verify the lifecycle (only the active
// sketch's draw loop advances).
//   node scripts/check.mjs [outDir]      (server must be running: npm run serve)
import { chromium, webkit } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE || 'http://localhost:4747';
const OUT = process.argv[2] || 'check-out';
const WAIT = Number(process.env.WAIT || 3000);
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

await mkdir(OUT, { recursive: true });
const browser = process.env.BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR || 1) });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${BASE}/?follow=0&mode=${process.env.MODE || 'ambient'}`);
await page.waitForFunction(() => window.__wallpaper);
const keys = await page.evaluate(() => window.__wallpaper.keys());

let failures = 0;
for (const key of keys) {
  if (only && !only.some((o) => key.includes(o))) continue;
  const sel = key.startsWith('dm:') ? { id: 'daily-minimal', sub: key.slice(3) } : { id: key };
  const before = errors.length;
  await page.evaluate((s) => window.__wallpaper.show(s), sel);
  await page.waitForTimeout(WAIT);
  const f1 = await page.evaluate(() => window.__wallpaper.frameCounts());
  await page.waitForTimeout(1000);
  const f2 = await page.evaluate(() => window.__wallpaper.frameCounts());
  const moving = Object.keys(f2).filter((k) => f1[k] !== null && f2[k] !== f1[k]);
  const leak = moving.filter((k) => k !== key);
  await page.screenshot({ path: `${OUT}/${key.replace(':', '_')}.png` });
  const errs = errors.slice(before);
  const ok = errs.length === 0 && leak.length === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${key.padEnd(20)} frames/s=${f1[key] === null ? '-' : (f2[key] - f1[key]).toString().padStart(3)}` +
      (leak.length ? `  other sketches still running: ${leak.join(', ')}` : '') +
      (errs.length ? `\n     errors: ${errs.join('\n             ')}` : ''),
  );
}
await browser.close();
process.exit(failures ? 1 : 0);
