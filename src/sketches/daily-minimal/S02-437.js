// S02-437 trails in triangle
// Concentric comet trails seen through a triangular window. At rest each
// trail's head sits where the original has it (fitted to the archive image).
// After a 15s hold the rings ease into orbit at different speeds, circle for
// a while, then each coasts to a stop back on its original angle.
// Thousands of small squares per frame, so they are drawn with the raw canvas
// API and precomputed colors.
import { dmSketch, restCycle, coastTo } from './harness.js';

const backC = 22;
const lineC = 255;
const w = 3.8;

// Measured from the original: rings about (CX, CY), ring n at R0 + STEP * n,
// and the triangle's center and inradius.
const CX = 300;
const CY = 300;
const R0 = 8.3;
const STEP = 13;
const TX = 302;
const TY = 302.5;
const TRI = 119.2;
// head angle of each ring at rest, n = 1, 2, ...
const REST = [1.156, 5.834, 1.911, 4.669, 2.417, 3.456, 5.943, 1.252, 4.708, 0.519, 2.705, 6.017, 4.547, 4.067, 5.603, 5.842, 2.614, 0];

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6;
const AWAY = 28;
const BACK = 7;

function makePath(p, n) {
  const r = R0 + STEP * n;
  const num = Math.round(r * 2);
  const colors = [];
  for (let i = 0; i < num; i++) {
    const amt = Math.min(1, Math.max(0, (i + num / 5) / num));
    const g = Math.round(lineC + (backC - lineC) * amt);
    colors.push(`rgb(${g},${g},${g})`);
  }
  // the original's 0.003-0.01 radians per frame at 60fps, turning backward
  const rest = REST[n - 1];
  return { r, num, colors, rest, t: rest, w: -p.random(0.18, 0.6) };
}

export default dmSketch({
  ow: 600,
  oh: 600,
  art: [TX - TRI * Math.sqrt(3), TY - 2 * TRI, 2 * TRI * Math.sqrt(3), 3 * TRI], // the triangle
  scale: 1,
  bg: backC,
  fps: 30,
  init(p, S) {
    S.paths = REST.map((_, i) => makePath(p, i + 1));
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
  },
  frame(p, S) {
    const c = S.cycle.step(S.dt);
    for (const path of S.paths) {
      if (c.phase === 'leave' || c.phase === 'away') path.t += path.w * (c.phase === 'leave' ? c.k : 1) * S.dt;
      else if (c.phase === 'back') {
        if (c.turned) path.home = coastTo(path.t, path.w, path.rest, BACK);
        path.t = path.home(c.u);
      } else path.t = path.rest;
    }

    const { ow: width, oh: height } = S;
    p.background(backC);
    const ctx = p.drawingContext;
    for (const path of S.paths) {
      for (let i = 0; i < path.num; i++) {
        const a = path.t + (i / path.num) * Math.PI * 2;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        ctx.save();
        ctx.transform(cs, sn, -sn, cs, CX + cs * path.r, CY + sn * path.r);
        ctx.fillStyle = path.colors[i];
        ctx.fillRect(-w / 2, -w / 2, w, w);
        ctx.restore();
      }
    }

    p.rectMode(p.CORNERS);
    p.noStroke();
    p.fill(backC);
    for (let i = 0; i < 3; i++) {
      p.push();
      p.translate(TX, TY);
      p.rotate((i / 3) * Math.PI * 2 + Math.PI / 2);
      p.rect(TRI, -height, width, height);
      p.pop();
    }
    if (c.phase === 'hold') S.sleep(c.left);
  },
});
