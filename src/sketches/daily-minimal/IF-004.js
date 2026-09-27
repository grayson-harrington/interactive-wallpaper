// IF-004 cube triangle
// An impossible triangle built from paper-textured isometric cubes, pointing
// down as in the original. After a 15s rest it turns once round over 36s,
// easing in and out and passing its three-fold symmetry, and lands back on the
// original. Processing's texture() with uv == xy is reproduced by clipping each
// face and drawing the paper texture in the same coordinates.
import { dmSketch, restCycle } from './harness.js';
import { paperCanvas, fillPathWithTexture } from '../../lib/paper.js';

const backC = 239;
const cubeR = 50;
const triangleR = 120;

// Timing, in seconds.
const HOLD = 15;
const TURN = 36; // one full turn, eased in and out

function side(ctx, tex, x, y, r, startA) {
  let a = startA;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  a += Math.PI / 3;
  ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  a += Math.PI / 3;
  ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  ctx.closePath();
  fillPathWithTexture(ctx, tex);
}

function cube(S, ctx, x, y, off, l, m, d) {
  if (l) side(ctx, S.light, x, y, cubeR, Math.PI + off);
  if (m) side(ctx, S.medium, x, y, cubeR, Math.PI / 3 + off);
  if (d) side(ctx, S.dark, x, y, cubeR, -Math.PI / 3 + off);
}

export default dmSketch({
  ow: 600,
  oh: 600,
  art: [146, 196, 308, 268], // the triangle at rest, pointing down
  scale: 1,
  bg: backC,
  fps: 30,
  init(p, S) {
    const opts = { specks: (600 * 600) / 250, speckSize: [0.5, 2] };
    S.light = paperCanvas(600, 600, { base: 218, ...opts });
    S.medium = paperCanvas(600, 600, { base: 118, ...opts });
    S.dark = paperCanvas(600, 600, { base: 45, ...opts });
    S.cycle = restCycle({ hold: HOLD, away: TURN });
  },
  frame(p, S) {
    const ctx = p.drawingContext;
    const cx = S.ow / 2;
    const cy = S.oh / 2;
    const pt = (a) => [cx + Math.cos(a) * triangleR, cy + Math.sin(a) * triangleR];
    const lerp = (a, b, t) => a + (b - a) * t;
    p.background(backC);
    const c = S.cycle.step(S.dt);
    const off = c.phase === 'away' ? Math.PI * 2 * c.k : 0;

    const corners = [pt(Math.PI + Math.PI / 6 + off), pt(-Math.PI / 6 + off), pt(Math.PI / 2 + off)];
    const edges = [
      [corners[0], corners[1], (i) => [i !== 1, i !== 1, true]], // top
      [corners[1], corners[2], () => [true, true, true]], // right
      [corners[2], corners[0], () => [true, true, true]], // left
    ];
    for (const [p1, p2, faces] of edges) {
      for (let i = 0; i <= 3; i++) {
        const [l, m, d] = faces(i);
        cube(S, ctx, lerp(p1[0], p2[0], i / 3), lerp(p1[1], p2[1], i / 3), off, l, m, d);
      }
    }
    // seal it off
    const [p1, p2] = [corners[0], corners[1]];
    cube(S, ctx, lerp(p1[0], p2[0], 1 / 3), lerp(p1[1], p2[1], 1 / 3), off, true, true, false);
    if (c.phase === 'hold') S.sleep(c.left);
  },
});
