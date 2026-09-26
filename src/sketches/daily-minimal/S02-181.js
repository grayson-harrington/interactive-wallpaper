// S02-181 glimpse beyond
// Two diamonds slide along a line; where they overlap, a window of dark paper
// opens up.
import { dmSketch } from './harness.js';
import { paperCanvas, fillPathWithTexture } from '../../lib/paper.js';

const backC = 239;
const lineC = 30;
const lineWeight = 3.5;

function makeSquare(p, S) {
  const height = S.oh;
  const d = p.random(height / 8, height / 2);
  let s = p.random(-2, 2);
  s = s > 0 ? s + 1 : s - 1;
  return { d, x: p.random(S.start + d, S.stop - d), y: height / 2, s };
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
  init(p, S) {
    p.randomSeed(32333);
    S.paperBack = paperCanvas(S.ow, S.oh, { base: lineC, specks: (S.ow * S.oh) / 500 });
    S.start = S.ow / 8;
    S.stop = S.ow - S.ow / 8;
    S.squares = [makeSquare(p, S), makeSquare(p, S)];
    S.frame = 0;
  },
  frame(p, S) {
    S.frame++;
    p.background(backC);
    p.strokeWeight(lineWeight);
    p.stroke(lineC);
    p.line(S.start, S.oh / 2, S.stop, S.oh / 2);

    for (let i = 0; i < S.squares.length; i++) {
      const q = S.squares[i];
      show(p, q);
      for (let j = 0; j < S.squares.length; j++) if (j !== i) interact(p, S, q, S.squares[j]);
      q.x = p.map(p.noise(S.frame / 300 + q.d * q.d * q.d), 0, 1, S.start + q.d, S.stop - q.d);
    }
  },
});
