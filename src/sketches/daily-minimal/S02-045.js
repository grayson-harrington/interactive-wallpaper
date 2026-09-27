// S02-045 waves through circle
// Two sine waves cross a ring, a thick one and a thin one carrying two small
// hollow circles. At rest they are the original (fitted to the archive
// image). After a 15s hold the waves start to travel along themselves and
// the circles ride along the thin one; then everything coasts to a stop
// back on the original.
import { dmSketch, restCycle, coastTo } from './harness.js';

const back = 237;
const TAU = Math.PI * 2;

// Fitted to the original, about the ring's center: each wave is
// y = A sin(TAU f x + p) + yoff in a frame turned by theta, drawn from x0 to x1.
const RING_D = 150;
const RING_W = 5.3;
const WAVES = [
  { theta: 0.5667, A: 25.6, f: 0.003978, p: 2.6536, yoff: 18.54, x0: -133.6, x1: 123.9, sw: 4 }, // thick
  { theta: 0.4181, A: 17.41, f: 0.004072, p: 1.4563, yoff: 21.01, x0: -133.3, x1: 114.9, sw: 2 }, // thin
];
// Riders on the thin wave: rest x along it, ring diameter, stroke.
const RIDERS = [
  { x: -48.9, d: 5, sw: 1.6, speed: 9 },
  { x: 47.6, d: 11, sw: 2.2, speed: 6 },
];

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6;
const AWAY = 28;
const BACK = 7;
const SCROLL = [30, 24]; // wave travel, px per second

export default dmSketch({
  ow: 400,
  oh: 400,
  art: [75, 122, 230, 156], // the ring and the waves across it, at rest
  scale: 1,
  bg: back,
  fps: 30,
  init(p, S) {
    S.scroll = [0, 0]; // as phase, radians: whole turns are the original
    S.ride = RIDERS.map(() => 0); // along the thin wave's span, as phase
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
  },
  frame(p, S) {
    const c = S.cycle.step(S.dt);
    const thin = WAVES[1];
    const span = thin.x1 - thin.x0;
    // phase speeds, radians per second
    const ws = WAVES.map((w, i) => TAU * w.f * SCROLL[i]);
    const wr = RIDERS.map((r) => (TAU * r.speed) / span);
    if (c.phase === 'leave' || c.phase === 'away') {
      const rate = c.phase === 'leave' ? c.k : 1;
      S.scroll = S.scroll.map((v, i) => v + ws[i] * rate * S.dt);
      S.ride = S.ride.map((v, i) => v + wr[i] * rate * S.dt);
    } else if (c.phase === 'back') {
      if (c.turned) {
        S.home = [...S.scroll.map((v, i) => coastTo(v, ws[i], 0, BACK)), ...S.ride.map((v, i) => coastTo(v, wr[i], 0, BACK))];
      }
      S.scroll = S.scroll.map((_, i) => S.home[i](c.u));
      S.ride = S.ride.map((_, i) => S.home[2 + i](c.u));
    } else {
      S.scroll = [0, 0];
      S.ride = RIDERS.map(() => 0);
    }

    p.background(back);
    p.translate(S.ow / 2, S.oh / 2);
    p.noFill();
    p.stroke(0);
    p.strokeWeight(RING_W);
    p.ellipse(0, 0, RING_D, RING_D);

    const y = (w, i, x) => w.A * Math.sin(TAU * w.f * x + w.p - S.scroll[i]) + w.yoff;
    WAVES.forEach((w, i) => {
      p.push();
      p.rotate(w.theta);
      p.strokeWeight(w.sw);
      p.beginShape();
      for (let x = w.x0; x < w.x1; x += 4) p.vertex(x, y(w, i, x));
      p.vertex(w.x1, y(w, i, w.x1));
      p.endShape();
      if (i === 1) {
        p.fill(back);
        RIDERS.forEach((r, j) => {
          // ride forward along the span, wrapping at its ends
          let x = r.x + (S.ride[j] / TAU) * span;
          x = thin.x0 + ((((x - thin.x0) % span) + span) % span);
          p.strokeWeight(r.sw);
          p.ellipse(x, y(w, i, x), r.d, r.d);
        });
        p.noFill();
      }
      p.pop();
    });
    if (c.phase === 'hold') S.sleep(c.left);
  },
});
