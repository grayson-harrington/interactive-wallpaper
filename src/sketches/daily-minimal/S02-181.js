// S02-181 glimpse beyond
// Two diamonds slide along a line; where they overlap, a window of dark paper
// opens up. At rest they sit where the original has them. After a 15s hold
// they ease into a noisy slide along the line, wander, then ease back.
import { dmSketch, restCycle } from './harness.js';
import { paperCanvas, fillPathWithTexture } from '../../lib/paper.js';

const backC = 239;
const lineC = 30;
const lineWeight = 3.5;

// The diamonds in the original: center x and half-diagonal, measured.
const REST = [
  [295.5, 91.5],
  [359.7, 67.2],
];

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6;
const AWAY = 28;
const BACK = 6;
const NOISE = 0.2; // noise time per second: the original's frame / 300 at 60fps

function makeSquare(S, [x, d]) {
  return { d, x, rest: x, y: S.oh / 2 };
}

function show(p, q) {
  p.strokeWeight(lineWeight);
  p.stroke(lineC);
  p.line(q.x + q.d, q.y, q.x, q.y - q.d);
  p.line(q.x - q.d, q.y, q.x, q.y - q.d);
  p.line(q.x + q.d, q.y, q.x, q.y + q.d);
  p.line(q.x - q.d, q.y, q.x, q.y + q.d);
}

function diamond(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.lineTo(cx, cy - r);
  ctx.closePath();
}

// Both diamonds sit on the same horizontal line, so their overlap is the
// diamond spanning the inner pair of left/right points. (The original picked
// between three cases and drew too wide a window when one diamond sat
// entirely inside the other.)
function interact(p, S, a, b) {
  const left = Math.max(a.x - a.d, b.x - b.d);
  const right = Math.min(a.x + a.d, b.x + b.d);
  if (right <= left) return;
  const ctx = p.drawingContext;
  diamond(ctx, (left + right) / 2, S.oh / 2, (right - left) / 2);
  fillPathWithTexture(ctx, S.paperBack);
}

export default dmSketch({
  ow: 800,
  oh: 300,
  art: [100, 0, 600, 300], // the track the diamonds slide along, at their largest
  scale: 1,
  bg: backC,
  fps: 30,
  init(p, S) {
    S.paperBack = paperCanvas(S.ow, S.oh, { base: lineC, specks: (S.ow * S.oh) / 500 });
    S.start = S.ow / 8;
    S.stop = S.ow - S.ow / 8;
    S.squares = REST.map((r) => makeSquare(S, r));
    S.t = p.random(1000);
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
  },
  frame(p, S) {
    const c = S.cycle.step(S.dt);
    if (c.phase === 'leave' || c.phase === 'away') S.t += NOISE * (c.phase === 'leave' ? c.k : 1) * S.dt;
    for (const q of S.squares) {
      const slide = p.map(p.noise(S.t + q.d * q.d * q.d), 0, 1, S.start + q.d, S.stop - q.d);
      if (c.phase === 'leave') q.x = q.rest + (slide - q.rest) * c.k;
      else if (c.phase === 'away') q.x = slide;
      else if (c.phase === 'back') {
        if (c.turned) q.from = q.x;
        q.x = q.from + (q.rest - q.from) * c.k;
      } else q.x = q.rest;
    }

    p.background(backC);
    p.strokeWeight(lineWeight);
    p.stroke(lineC);
    p.line(S.start, S.oh / 2, S.stop, S.oh / 2);

    for (let i = 0; i < S.squares.length; i++) {
      const q = S.squares[i];
      show(p, q);
      for (let j = 0; j < S.squares.length; j++) if (j !== i) interact(p, S, q, S.squares[j]);
    }
    if (c.phase === 'hold') S.sleep(c.left);
  },
});
