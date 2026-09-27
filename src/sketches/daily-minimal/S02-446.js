// S02-446 controlled noise
// Noisy rings drawn on top of each other. At rest they are the original: a
// ring with five lines peeling inward from it at its lower right, fanned like
// pages. After a 15s hold the fan melts into noise that only shows up near a
// slowly wandering point, drifts for a while, then eases back into the fan.
// With someone at the page, the noise follows the mouse instead. A click adds
// a ring, up to twelve; once the clicks stop, the added rings fade away one at
// a time, back to the original six.
import { dmSketch, wanderer, restCycle } from './harness.js';

const backC = 22;
const lineC = 246;
const maxDoff = 100;

// Rest pose, measured from the original: how far each ring is pulled inward,
// in px, at 0, 4, ... 80 degrees (clockwise from 3 o'clock); zero elsewhere.
// A sixth ring, and any added with a click, rests on the circle itself.
const REST_STEP = (4 * Math.PI) / 180;
const REST = [
  [0, 1.9, 8.9, 17.2, 25.4, 31.9, 37.7, 42.1, 45.7, 48, 49.4, 50, 49.6, 47.6, 44.1, 39.5, 32.3, 21.7, 10.1, 2.1, 0],
  [0, 1, 5.9, 14.6, 20.5, 25.8, 30.7, 34.9, 38, 40.3, 40.5, 39.1, 36.3, 31.8, 26.3, 19.6, 13.6, 8, 4.5, 1, 0],
  [0, 0.5, 4, 11, 16, 20.8, 24.5, 26.9, 27.8, 26.9, 24, 20.8, 17.2, 13.7, 10.7, 8, 5.7, 3.9, 1.5, 0.5, 0],
  [0, 0.2, 2.5, 8, 12.3, 15.2, 16.7, 16.5, 14.2, 12.1, 9.8, 8, 6.3, 5.2, 4.3, 3.1, 2.3, 1.9, 0.8, 0.3, 0],
  [0, 0.1, 1.2, 4.8, 7.1, 8.8, 8.6, 6.7, 5.3, 4.1, 3.4, 3.1, 2.7, 2.6, 2.3, 1.5, 1.2, 1, 0.4, 0.1, 0],
];

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6;
const AWAY = 28;
const BACK = 6;
const NOISE_RATE = 0.42; // noise z per second, as the original's 0.007 per frame at 60fps
const FOLLOW = 3; // per second, toward the cursor
const MAX_RINGS = 12;
const GROW = 0.6; // an added ring fading in
const FADE = 1.5; // an added ring fading out
const QUIET = 8; // after the last click, before added rings start to go
const DRAIN = 3; // between added rings going

// Processing's constrain (low wins over high when they cross)
const constrain = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Catmull-Rom through a ring's rest table.
function restPull(table, a) {
  if (!table || a < 0 || a >= (table.length - 1) * REST_STEP) return 0;
  const x = a / REST_STEP;
  const i = Math.floor(x);
  const t = x - i;
  const p0 = table[Math.max(0, i - 1)];
  const p1 = table[i];
  const p2 = table[i + 1];
  const p3 = table[Math.min(table.length - 1, i + 2)];
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

function noiseCircle(zoff, alpha = 1) {
  return { cx: 250, cy: 250, d: 300, numPoints: 400, zoff, noiseMax: 0.5, alpha, fade: 0 };
}

export default dmSketch({
  ow: 500,
  oh: 500,
  art: [100, 100, 300, 300], // the circle
  scale: 1,
  bg: backC,
  fps: 30,
  init(p, S) {
    S.circles = Array.from({ length: 6 }, (_, i) => noiseCircle(i * 5));
    S.wander = wanderer(p, 250, 250, 210, 0.21);
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
    S.mix = 0; // 0: the original's fan, 1: noise around the point
    S.pt = [370, 330];
    S.wasLive = false;
    S.quiet = 0;
    S.drainAt = 0;
  },
  frame(p, S) {
    const c = S.cycle;
    if (S.live) {
      const k = 1 - Math.exp(-FOLLOW * S.dt);
      S.mix += (1 - S.mix) * k;
      S.pt[0] += (S.mouseX - S.pt[0]) * k;
      S.pt[1] += (S.mouseY - S.pt[1]) * k;
    } else {
      if (S.wasLive) c.toRest(BACK);
      else c.step(S.dt);
      if (c.turned && c.phase === 'back') S.from = S.mix;
      if (c.phase === 'hold') S.mix = 0;
      else if (c.phase === 'leave') S.mix = c.k;
      else if (c.phase === 'away') S.mix = 1;
      else S.mix = S.from * (1 - c.k);
      // the wandering point stands in for the mouse; it glides out from where it was
      const w = S.wander();
      const k = S.mix;
      S.pt = [S.pt[0] + (w[0] - S.pt[0]) * Math.min(1, k * FOLLOW * S.dt), S.pt[1] + (w[1] - S.pt[1]) * Math.min(1, k * FOLLOW * S.dt)];
    }
    S.wasLive = S.live;

    // added rings: fade in, and once clicks stop, fade out newest first
    S.quiet += S.dt;
    for (const nc of S.circles) {
      if (nc.fade) {
        nc.alpha = Math.min(1, Math.max(0, nc.alpha + (nc.fade * S.dt) / (nc.fade > 0 ? GROW : FADE)));
        if ((nc.fade > 0 && nc.alpha === 1) || (nc.fade < 0 && nc.alpha === 0)) nc.fade = 0;
      }
    }
    S.circles = S.circles.filter((nc) => nc.alpha > 0 || nc.fade > 0);
    const extra = S.circles.length > REST.length + 1;
    if (extra && S.quiet > QUIET && S.quiet > S.drainAt && !S.circles.some((nc) => nc.fade < 0)) {
      S.circles[S.circles.length - 1].fade = -1;
      S.drainAt = S.quiet + FADE + DRAIN;
    }

    const [mx, my] = S.pt;
    const mix = S.mix;
    p.background(backC);
    p.stroke(lineC);
    p.strokeWeight(1);
    p.noFill();
    S.circles.forEach((nc, ring) => {
      const table = REST[ring];
      p.stroke(lineC, 255 * nc.alpha);
      const distEffect = p.map(Math.hypot(mx - nc.cx, my - nc.cy), 0, nc.d / 2, nc.d / 2 + 20, 100);
      p.beginShape();
      for (let i = 0; i < nc.numPoints; i++) {
        const a = (i / nc.numPoints) * Math.PI * 2;
        let doff = 0;
        if (mix > 0) {
          const xoff = p.map(Math.cos(a), -1, 1, 0, nc.noiseMax);
          const yoff = p.map(Math.sin(a), -1, 1, 0, nc.noiseMax);
          doff = p.map(p.noise(xoff, yoff, nc.zoff), 0, 1, -maxDoff, maxDoff);
          let dist = Math.hypot(nc.cx + (Math.cos(a) * nc.d) / 2 - mx, nc.cy + (Math.sin(a) * nc.d) / 2 - my);
          dist = constrain(dist, 0, distEffect);
          doff *= p.map(dist * dist, 0, distEffect * distEffect, 1, 0);
        }
        const r = nc.d / 2 + mix * doff - (1 - mix) * restPull(table, a);
        p.vertex(nc.cx + r * Math.cos(a), nc.cy + r * Math.sin(a));
      }
      p.endShape(p.CLOSE);
      nc.zoff += NOISE_RATE * mix * S.dt;
    });
    if (!S.live && c.phase === 'hold' && !extra) S.sleep(c.left);
  },
  mousePressed(p, S) {
    S.quiet = 0;
    S.drainAt = 0;
    if (S.circles.length >= MAX_RINGS) return;
    const nc = noiseCircle(S.circles.length * 5, 0);
    nc.fade = 1;
    S.circles.push(nc);
  },
});
