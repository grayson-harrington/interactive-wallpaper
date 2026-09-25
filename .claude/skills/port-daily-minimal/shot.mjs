// Screenshot a Daily Minimal port at 1:1 in its original coordinates, so it
// can be laid over the source image.
//   node .claude/skills/port-daily-minimal/shot.mjs <id> <out.png> [waitMs] [mode] [ow] [oh]
// e.g. node .claude/skills/port-daily-minimal/shot.mjs S02-582 /tmp/rest.png 1500
// The server must be serving a fresh build (npm run build). The harness scales
// the original canvas by FIT of the viewport, so the viewport is sized to make
// that scale exactly 1 and the clip is the original canvas.
import { chromium } from 'playwright';

const FIT = 0.74; // keep in sync with src/sketches/daily-minimal/harness.js
const [, , id, out, wait = '1500', mode = 'ambient', ow = '1000', oh = ow] = process.argv;
if (!id || !out) {
  console.error('usage: shot.mjs <id> <out.png> [waitMs] [mode] [ow] [oh]');
  process.exit(1);
}
const W = Number(ow);
const H = Number(oh);
const side = Math.ceil(Math.max(W, H) / FIT);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: side, height: side }, deviceScaleFactor: 1 });
await page.goto(`${process.env.BASE || 'http://localhost:4747'}/?follow=0&ui=0&mode=${mode}`);
await page.waitForFunction(() => window.__wallpaper);
await page.addStyleTag({ content: '.dm-credit { display: none !important; }' });
await page.evaluate((s) => window.__wallpaper.show({ id: 'daily-minimal', sub: s }), id);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out, clip: { x: (side - W) / 2, y: (side - H) / 2, width: W, height: H } });
await browser.close();
console.log(out);
