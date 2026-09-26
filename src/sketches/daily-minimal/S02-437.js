// S02-437 trails in triangle
// Concentric comet trails orbiting at different speeds, seen through a
// triangular window. Thousands of small squares per frame, so they are drawn
// with the raw canvas API and precomputed colors.
import { dmSketch } from './harness.js';

const backC = 22;
const lineC = 255;
const spacing = 13;
const triSize = 100;
const w = 5;

function makePath(p, x, y, r) {
  const num = r * 2;
  const colors = [];
  for (let i = 0; i < num; i++) {
    const amt = Math.min(1, Math.max(0, (i + num / 5) / num));
    const g = Math.round(lineC + (backC - lineC) * amt);
    colors.push(`rgb(${g},${g},${g})`);
  }
  return { x, y, r, num, colors, t: p.random(Math.PI * 2), tStep: p.random(0.003, 0.01) };
}

export default dmSketch({
  ow: 500,
  oh: 500,
  art: [78, 85, 344, 299], // the triangle
  scale: 1,
  bg: backC,
  init(p, S) {
    S.paths = [];
    for (let i = 0; i < S.ow / 2 / spacing; i++) S.paths.push(makePath(p, S.ow / 2, S.oh / 2, i * spacing));
  },
  frame(p, S) {
    const { ow: width, oh: height } = S;
    p.translate(0, height / 15);
    p.background(backC);

    const ctx = p.drawingContext;
    for (const path of S.paths) {
      for (let i = 0; i < path.num; i++) {
        const a = path.t + (i / path.num) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        ctx.save();
        ctx.transform(c, s, -s, c, path.x + c * path.r, path.y + s * path.r);
        ctx.fillStyle = path.colors[i];
        ctx.fillRect(-w / 2, -w / 2, w, w);
        ctx.restore();
      }
      path.t -= path.tStep;
    }

    p.rectMode(p.CORNERS);
    p.noStroke();
    p.fill(backC);
    for (let i = 0; i < 3; i++) {
      p.push();
      p.translate(width / 2, height / 2);
      p.rotate((i / 3) * Math.PI * 2 + Math.PI / 2);
      p.rect(triSize, -height, width, height);
      p.pop();
    }
  },
});
