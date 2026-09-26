// Screenshot a Daily Minimal port at 1:1 in its original coordinates, so it
// can be laid over the source image.
//   node .claude/skills/port-daily-minimal/shot.mjs <id> <out.png> [waitMs] [mode] [ow] [oh]
// e.g. node .claude/skills/port-daily-minimal/shot.mjs S02-582 /tmp/rest.png 1500
// The server must be serving a fresh build (npm run build). ?native=1 makes the
// harness draw at scale 1 with the canvas centered, so a viewport of exactly
// ow x oh shows the original canvas (piece `scale` and `art` are ignored).
import { chromium } from 'playwright';

const [, , id, out, wait = '1500', mode = 'ambient', ow = '1000', oh = ow] = process.argv;
if (!id || !out) {
  console.error('usage: shot.mjs <id> <out.png> [waitMs] [mode] [ow] [oh]');
  process.exit(1);
}
const W = Number(ow);
const H = Number(oh);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.goto(`${process.env.BASE || 'http://localhost:4747'}/?follow=0&ui=0&native=1&mode=${mode}`);
await page.waitForFunction(() => window.__wallpaper);
await page.addStyleTag({ content: '.dm-credit { display: none !important; }' });
await page.evaluate((s) => window.__wallpaper.show({ id: 'daily-minimal', sub: s }), id);
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close();
console.log(out);
