// S02-589 wobbly ring
// A thick circle with a thin, wobbly outline hugging it, a diagonal line with a
// thin twin, a small ring and a dot. After a 15s rest, over 36s the outline
// drifts through a Perlin-noise wobble and settles back into its original
// shape, the thin twin slides up and down the diagonal, and the ring and dot
// ride toward each other along it. With someone at the page all of that keeps
// going on its own, and the outline is also deflected toward the cursor, easing
// back when they leave.
import { dmSketch, restCycle } from './harness.js';

const bg = 239;
const ink = 22;

// Geometry, measured.
const CX = 442.75;
const CY = 456.4;
const R = 149.3;
const RING_W = 8.3;
const LINE_A = [186, 442.5];
const LINE_B = [801, 654];
const LINE_W = 5;
const TWIN_A = [359, 513];
const TWIN_B = [735, 642];
const TWIN_W = 1.3;
const SMALL_RING = { x: 219.75, y: 489, r: 15.75, w: 9 };
const DOT = { x: 779.5, y: 627, r: 11 };

// How far the thin outline sits outside (+) or inside (-) the circle, every 10
// degrees from the +x axis, going clockwise on screen.
const DEV = [
  -17, -24, -22, -15, -4, 8, 13, 8, 0, -15, -16, -10, -3, 4, 8, 9, 8, 7, 8, 10, 14, 16, 16.5, 15, 14, 13, 10, -2, -12, -13.6, -10.7,
  0, 8, 13, 0, -10,
];
const N = DEV.length;
const OUTLINE_W = 1.3;
const SAMPLES = 360;

// Perlin wobble: noise walked around the circle, and through time.
const NOISE_SCALE = 1.1; // radius of the circle in noise space
const NOISE_SPEED = 0.12; // noise units per second
const NOISE_AMP = 80; // px per unit of noise, around its middle

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;

const FOLLOW = 2.5; // per second
const RELEASE = 1.5; // the deflection easing back, per second
const PUSH_REACH = 24; // most the outline is pushed toward the cursor, px
const PUSH_WIDTH = 0.5; // radians
const SLIDE_UP = 60; // px the twin slides along the diagonal, each way
const SLIDE_DOWN = 150;
const RIDE = 110; // px the ring and dot ride along it
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const LEN = Math.hypot(LINE_B[0] - LINE_A[0], LINE_B[1] - LINE_A[1]);
const ux = (LINE_B[0] - LINE_A[0]) / LEN;
const uy = (LINE_B[1] - LINE_A[1]) / LEN;

// Periodic Catmull-Rom through DEV at a turn angle a (radians).
function dev(a) {
  const f = ((((a / TAU) % 1) + 1) % 1) * N;
  const i = Math.floor(f);
  const t = f - i;
  const p0 = DEV[(i + N - 1) % N];
  const p1 = DEV[i % N];
  const p2 = DEV[(i + 1) % N];
  const p3 = DEV[(i + 2) % N];
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

const cosA = new Float32Array(SAMPLES + 1);
const sinA = new Float32Array(SAMPLES + 1);
const base = new Float32Array(SAMPLES + 1); // the original's deviation
for (let i = 0; i <= SAMPLES; i++) {
  cosA[i] = Math.cos((i / SAMPLES) * TAU);
  sinA[i] = Math.sin((i / SAMPLES) * TAU);
  base[i] = dev((i / SAMPLES) * TAU);
}

// wobble at sample i and noise time t
function wobble(p, i, t) {
  return (p.noise(20 + NOISE_SCALE * cosA[i], 20 + NOISE_SCALE * sinA[i], t) - 0.5) * NOISE_AMP;
}

function draw(p, S, s) {
  const ctx = p.drawingContext;
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.fillStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineCap = 'butt';

  // thick circle
  ctx.lineWidth = RING_W;
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, TAU);
  ctx.stroke();

  // thin wobbly outline: the original shape plus the noise's drift away from
  // where it started, plus the push toward the cursor
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  for (let i = 0; i <= SAMPLES; i++) {
    let d = base[i];
    if (s.env > 0) d += s.env * (wobble(p, i, s.t) - S.wobble0[i]);
    if (s.push) {
      let da = ((i / SAMPLES) * TAU - s.pushAt) % TAU;
      if (da > Math.PI) da -= TAU;
      else if (da < -Math.PI) da += TAU;
      d += s.push * Math.exp(-((da / PUSH_WIDTH) ** 2));
    }
    const r = R + d;
    const x = CX + r * cosA[i];
    const y = CY + r * sinA[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // diagonal and its twin
  ctx.lineWidth = LINE_W;
  ctx.beginPath();
  ctx.moveTo(...LINE_A);
  ctx.lineTo(...LINE_B);
  ctx.stroke();
  ctx.lineWidth = TWIN_W;
  ctx.beginPath();
  const t = s.slide * (s.slide > 0 ? SLIDE_UP : SLIDE_DOWN);
  const ride = s.slide * s.slide * RIDE;
  ctx.moveTo(TWIN_A[0] + ux * t, TWIN_A[1] + uy * t);
  ctx.lineTo(TWIN_B[0] + ux * t, TWIN_B[1] + uy * t);
  ctx.stroke();

  // small ring and dot, riding the diagonal toward each other
  ctx.lineWidth = SMALL_RING.w;
  ctx.beginPath();
  ctx.arc(SMALL_RING.x + ux * ride, SMALL_RING.y + uy * ride, SMALL_RING.r, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(DOT.x - ux * ride, DOT.y - uy * ride, DOT.r, 0, TAU);
  ctx.fill();
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: [185, 299, 618, 357],
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    p.noiseSeed(589);
    S.wobble0 = new Float32Array(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) S.wobble0[i] = wobble(p, i, 0);
    S.cyc = restCycle({ hold: HOLD, away: AWAY });
    // env: how much of the noise drift is showing; t: noise time
    S.s = { env: 0, t: 0, slide: 0, push: 0, pushAt: 0 };
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(S.dt, 0.1);
    const s = S.s;

    // the ambient cycle runs the same with or without someone at the page
    const c = S.cyc;
    c.step(S.dt);
    const away = c.phase === 'away';
    s.env = away ? Math.sin(Math.PI * c.u) ** 2 : 0;
    s.t = away ? c.u * AWAY * NOISE_SPEED : 0;
    s.slide = away ? Math.sin(TAU * 2 * c.k) : 0;

    // the outline is also deflected toward the cursor
    if (S.live) {
      const k = Math.min(1, FOLLOW * dt);
      const dx = S.mouseX - CX;
      const dy = S.mouseY - CY;
      let da = Math.atan2(dy, dx) - s.pushAt;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      s.pushAt += da * k;
      s.push += (clamp((Math.hypot(dx, dy) - R) * 0.3, -PUSH_REACH, PUSH_REACH) - s.push) * k;
    } else if (s.push) {
      s.push *= Math.max(0, 1 - RELEASE * dt);
      if (Math.abs(s.push) < 0.05) s.push = 0;
    }

    draw(p, S, s);

    if (c.phase === 'hold' && !S.live && !s.push) S.sleep(c.left);
  },
});
