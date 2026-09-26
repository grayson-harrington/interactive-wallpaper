// Report how big Daily Minimal pieces look on screen.
//   node .claude/skills/port-daily-minimal/size.mjs [id,id,...] [waitMs] [WxH]
// e.g. node .claude/skills/port-daily-minimal/size.mjs S02-582
// With no ids it measures every piece. The server must be serving a fresh build.
// Prints the bounding box of everything that differs from the background and its
// equal-area side sqrt(w*h) as a share of the shorter screen side. The harness
// aims the piece's `art` box at SIZE (0.5), so a piece whose main form is all
// that's drawn should read about 0.5. Extras outside `art` (lines running off,
// wave tails) read higher; that's expected.
import { chromium } from 'playwright';

const [, , ids, wait = '1500', view = '1600x1000'] = process.argv;
const [VW, VH] = view.split('x').map(Number);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
await page.goto(`${process.env.BASE || 'http://localhost:4747'}/?follow=0&ui=0&mode=ambient`);
await page.waitForFunction(() => window.__wallpaper);
await page.addStyleTag({ content: '.dm-credit { display: none !important; }' });
const all = (await page.evaluate(() => window.__wallpaper.keys())).filter((k) => k.startsWith('dm:')).map((k) => k.slice(3));
const only = ids && ids !== 'all' ? ids.split(',') : all;

for (const id of only) {
  await page.evaluate((s) => window.__wallpaper.show({ id: 'daily-minimal', sub: s }), id);
  await page.waitForTimeout(Number(wait));
  const png = (await page.screenshot()).toString('base64');
  const box = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const [br, bg, bb] = [d[0], d[1], d[2]];
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4;
        if (Math.abs(d[k] - br) + Math.abs(d[k + 1] - bg) + Math.abs(d[k + 2] - bb) > 30) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  }, png);
  if (!box) {
    console.log(`${id.padEnd(8)} blank`);
    continue;
  }
  const [x, y, w, h] = box;
  const m = Math.min(VW, VH);
  const cx = x + w / 2 - VW / 2;
  const cy = y + h / 2 - VH / 2;
  console.log(
    `${id.padEnd(8)} size ${(Math.sqrt(w * h) / m).toFixed(2)}  longest ${(Math.max(w, h) / m).toFixed(2)}  ` +
      `box ${w}x${h}  off-center ${cx.toFixed(0)},${cy.toFixed(0)}`,
  );
}
await browser.close();
