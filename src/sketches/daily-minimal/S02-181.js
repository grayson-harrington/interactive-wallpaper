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

function interact(p, S, a, b) {
  const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  if (dist(a.x, a.y, b.x, b.y) > a.d + b.d) return;
  const ctx = p.drawingContext;
  const midY = S.oh / 2;
  if (dist(a.x, a.y, b.x - b.d, b.y) < a.d && dist(a.x, a.y, b.x + b.d, b.y) < a.d) {
    diamond(ctx, b.x, b.y, b.d); // b fully inside a
  } else if (dist(a.x, a.y, b.x + a.d, b.y) < a.d) {
    const newx = (b.x + b.d + (a.x - a.d)) / 2;
    const diag = (b.x + b.d - (a.x - a.d)) / 2;
    diamond(ctx, newx, midY, diag);
  } else if (dist(a.x, a.y, b.x - a.d, b.y) < a.d) {
    const newx = (b.x - b.d + (a.x + a.d)) / 2;
    const diag = (a.x + a.d - (b.x - b.d)) / 2;
    diamond(ctx, newx, midY, diag);
  } else {
    return;
  }
  fillPathWithTexture(ctx, S.paperBack);
}

export default dmSketch({
  ow: 800,
  oh: 300,
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
