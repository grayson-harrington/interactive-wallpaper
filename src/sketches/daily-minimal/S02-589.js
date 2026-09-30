// S02-589 wobbly ring
// A thick circle with a thin, wobbly outline hugging it, a diagonal line with a
// thin twin, a small ring and a dot. After a 15s rest, over 36s the wobble
// travels once around the circle while breathing, the thin twin slides up and
// down the diagonal, and the ring and dot ride toward each other along it, all
// landing back on the original. With someone at the page the outline bulges
// toward the cursor, and it eases home when they leave.
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

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;
const HOME = 6; // easing home after someone leaves

const FOLLOW = 2.5; // per second
const PUSH_REACH = 24; // most the outline is pushed toward the cursor, px
const PUSH_WIDTH = 0.5; // radians
const SLIDE_UP = 60; // px the twin slides along the diagonal, each way
const SLIDE_DOWN = 150;
const RIDE = 110; // px the ring and dot ride along it
const BREATH = 0.35;
const TAU = Math.PI * 2;
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const LEN = Math.hypot(LINE_B[0] - LINE_A[0], LINE_B[1] - LINE_A[1]);
const ux = (LINE_B[0] - LINE_A[0]) / LEN;
const uy = (LINE_B[1] - LINE_A[1]) / LEN;

// Periodic Catmull-Rom through DEV at a turn angle a (radians).
function dev(a) {
  const f = (((a / TAU) % 1) + 1) % 1 * N;
  const i = Math.floor(f);
  const t = f - i;
  const p0 = DEV[(i + N - 1) % N];
  const p1 = DEV[i % N];
  const p2 = DEV[(i + 1) % N];
  const p3 = DEV[(i + 2) % N];
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
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

  // thin wobbly outline: the wobble turned by s.shift, breathing, and pushed
  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  for (let i = 0; i <= SAMPLES; i++) {
    const a = (i / SAMPLES) * TAU;
    let d = dev(a - s.shift) * s.amp;
    if (s.push) {
      let da = (a - s.pushAt) % TAU;
      if (da > Math.PI) da -= TAU;
      else if (da < -Math.PI) da += TAU;
      d += s.push * Math.exp(-((da / PUSH_WIDTH) ** 2));
    }
    const r = R + d;
    const x = CX + r * Math.cos(a);
    const y = CY + r * Math.sin(a);
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

  // small ring and dot, riding the diagonal in opposite directions
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
    S.cyc = restCycle({ hold: HOLD, away: AWAY });
    S.mode = 'cycle'; // cycle | live | home
    S.s = { shift: 0, amp: 1, slide: 0, push: 0, pushAt: 0 };
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(S.dt, 0.1);
    const s = S.s;

    if (S.live && S.mode !== 'live') S.mode = 'live';
    else if (!S.live && S.mode === 'live') {
      S.mode = 'home';
      S.homeU = 0;
      S.from = { ...s };
      // the wobble comes home by the nearest whole turn
      S.homeShift = Math.round(s.shift / TAU) * TAU;
    }

    if (S.mode === 'live') {
      const k = Math.min(1, FOLLOW * dt);
      s.shift += (Math.round(s.shift / TAU) * TAU - s.shift) * k * 0.5;
      s.amp += (1 - s.amp) * k;
      s.slide += (0 - s.slide) * k;
      const dx = S.mouseX - CX;
      const dy = S.mouseY - CY;
      const at = Math.atan2(dy, dx);
      let da = at - s.pushAt;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      s.pushAt += da * k;
      s.push += (clamp((Math.hypot(dx, dy) - R) * 0.3, -PUSH_REACH, PUSH_REACH) - s.push) * k;
    } else if (S.mode === 'home') {
      S.homeU = Math.min(1, S.homeU + dt / HOME);
      const e = smoother(S.homeU);
      const f = S.from;
      s.shift = f.shift + (S.homeShift - f.shift) * e;
      s.amp = f.amp + (1 - f.amp) * e;
      s.slide = f.slide * (1 - e);
      s.push = f.push * (1 - e);
      if (S.homeU >= 1) {
        S.s = { shift: 0, amp: 1, slide: 0, push: 0, pushAt: s.pushAt };
        S.mode = 'cycle';
        S.cyc = restCycle({ hold: HOLD, away: AWAY });
      }
    } else {
      const c = S.cyc;
      c.step(S.dt);
      const k = c.phase === 'away' ? c.k : 0;
      s.shift = TAU * k;
      s.amp = 1 + BREATH * Math.sin(TAU * 3 * k) * (c.phase === 'away' ? 1 : 0);
      s.slide = c.phase === 'away' ? Math.sin(TAU * 2 * k) : 0;
    }

    draw(p, S, S.s);

    if (S.mode === 'cycle' && S.cyc.phase === 'hold') S.sleep(S.cyc.left);
  },
});
