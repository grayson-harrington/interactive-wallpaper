// S02-474 popup lines
// Random straight lines inside a circle. At rest they are the original's
// lines, traced from the archive image and stacked in the same order. After a
// 15s hold, lines pop one at a time, every 1.5s: twelve of them are swapped
// for new random ones, then the originals pop back in reverse order until the
// image is the original again.
import { dmSketch, restCycle } from './harness.js';

const backC = 239;
const lineC = 15;

// The original's lines, bottom to top: [x1, y1, x2, y2].
const REST = [
  [386.5, 216.3, 163.8, 361],
  [381.3, 197.2, 196.7, 248],
  [340.5, 141.1, 257.6, 254.6],
  [253.8, 219, 168.6, 134.1],
  [355.3, 342.9, 250.7, 302],
  [389.7, 248, 300.8, 291.8],
  [185.6, 126.6, 185.8, 219.5],
  [119.9, 229.1, 151.2, 307],
  [179.9, 281.9, 167.2, 362],
  [185.9, 247.4, 110.1, 227.9],
  [185.8, 245.1, 110, 227.7],
  [274.6, 318.8, 325.2, 369.5],
  [195.6, 120.7, 374.7, 314.1],
  [265.9, 114.4, 382.4, 282.8],
  [251.9, 273.6, 115, 293],
  [340.9, 349.6, 263.6, 349.3],
  [297.2, 286.4, 271.4, 324.8],
  [386.4, 283.5, 253.3, 293.5],
  [304, 118.9, 251, 311.3],
  [269.6, 109.6, 222.9, 389.2],
  [360.6, 338.3, 117.5, 200],
  [373.3, 315.7, 120.4, 302.3],
  [302, 373.9, 135.5, 320.2],
  [311.4, 354.2, 167.1, 355.2],
  [343.2, 145.1, 249.3, 390.5],
  [379.7, 276.4, 278.8, 379],
  [318.3, 371.5, 219.2, 305],
  [391.7, 242.8, 108.9, 262.4],
  [373, 192.3, 189.5, 128.6],
  [158, 150.5, 160.3, 352.8],
  [365.8, 171.3, 112.7, 221.3],
  [337.5, 144.2, 127.4, 188.4],
  [193.3, 120.7, 242.5, 390.7],
  [259.8, 110.6, 135.9, 330.4],
  [162.9, 141.1, 211.3, 383.9],
  [387.2, 285.6, 119.4, 195.5],
];

// Timing, in seconds.
const HOLD = 15;
const SWAPS = 12; // lines swapped out, then back
const STEP = 1.5; // between pops
const AWAY = 2 * SWAPS * STEP;

function drawLine(p, [x1, y1, x2, y2]) {
  p.strokeWeight(6);
  p.stroke(backC);
  p.line(x1, y1, x2, y2);
  p.strokeWeight(3);
  p.stroke(lineC);
  p.line(x1, y1, x2, y2);
}

export default dmSketch({
  ow: 500,
  oh: 500,
  art: [125, 125, 250, 250], // the circular window the lines show through
  scale: 1,
  bg: backC,
  fps: 30,
  init(p, S) {
    S.cycle = restCycle({ hold: HOLD, away: AWAY });
    S.swapped = []; // [index, new line], in the order they popped in
    S.picks = [];
  },
  frame(p, S) {
    const c = S.cycle.step(S.dt);
    if (c.phase === 'away') {
      if (c.turned) {
        // twelve distinct lines to swap this time
        const idx = REST.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        S.picks = idx.slice(0, SWAPS);
      }
      // pops due by now: the first SWAPS swap lines out, the rest put them back
      const due = Math.min(2 * SWAPS, Math.floor((c.u * AWAY) / STEP) + 1);
      const r = () => [p.random(S.ow), p.random(S.oh)];
      while (S.swapped.length < Math.min(due, SWAPS) && !S.restoring) {
        S.swapped.push([S.picks[S.swapped.length], [...r(), ...r()]]);
      }
      if (due > SWAPS) {
        S.restoring = true;
        const keep = 2 * SWAPS - due;
        if (S.swapped.length > keep) S.swapped.length = keep;
      }
    } else {
      S.swapped = [];
      S.restoring = false;
    }

    p.background(backC);
    const out = new Set(S.swapped.map(([i]) => i));
    REST.forEach((l, i) => out.has(i) || drawLine(p, l));
    for (const [, l] of S.swapped) drawLine(p, l);

    p.noFill();
    p.stroke(backC);
    p.strokeWeight(250);
    p.ellipse(S.ow / 2, S.oh / 2, 500, 500);

    // still between pops
    if (c.phase === 'hold') S.sleep(c.left);
    else {
      const t = c.u * AWAY;
      S.sleep(Math.min(c.left, STEP - (t % STEP)) + 0.01);
    }
  },
});
