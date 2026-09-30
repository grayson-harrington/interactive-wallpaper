// S02-557 sigil
// A dark sigil hung on a vertical axis: an inverted triangle over a diamond and
// two thin circles, a slashed ring at the center, a ring and a dot below. After
// a 15s rest the whole sigil swings from the top of its axis like a pendulum,
// three swings over 36s that ease in and out, and lands back on the original.
// With someone at the page it hangs toward the cursor on a springy pendulum,
// and eases home when they leave.
import { dmSketch, restCycle } from './harness.js';

const bg = 22;
const ink = 238;

// Geometry, measured.
const AX = 499.5;
const CY = 446.2;
const PIVOT = [AX, 177]; // top of the axis
const AXIS_END = 725;
const DASHES = [
  [177, 189],
  [195, 206],
  [214, 229],
  [240, 258],
]; // then solid to the end
const AXIS_W = 2.2;
const BAR = { y: 285, half: 26.5, w: 2.6 };
const TRI = { top: 296.5, half: 63.5, apex: 401, w: 5 };
const DIAMOND = 132.3;
const THIN = 1.3;
const CIRCLES = [104, 61];
const RING = { r: 27, w: 5 };
const SLASH = { r: 21, w: 3 };
const TINY = [
  { x: 468.5, y: 415.5, r: 3.2 },
  { x: 531, y: 477, r: 3.2 },
];
const LOWER_RING = { y: 610, r: 15.5, w: 4 };
const BALL = { y: 654.5, r: 10 };
const CROSS = { y: 675, half: 13, w: 2.6 };

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;
const HOME = 6; // easing home after someone leaves

const SWING = 0.2; // radians, peak of the ambient swing
const SWINGS = 3;
const REACH = 0.4; // radians, most the cursor hangs it over
const SPRING = 12; // per second squared
const DAMP = 3.5; // per second
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function draw(p, S, swing) {
  const ctx = p.drawingContext;
  ctx.save();
  ctx.translate(PIVOT[0], PIVOT[1]);
  ctx.rotate(swing);
  ctx.translate(-PIVOT[0], -PIVOT[1]);
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.fillStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // axis: dashed at the top, then solid
  ctx.lineWidth = AXIS_W;
  ctx.beginPath();
  for (const [a, b] of DASHES) {
    ctx.moveTo(AX, a);
    ctx.lineTo(AX, b);
  }
  ctx.moveTo(AX, DASHES[DASHES.length - 1][1] + 7);
  ctx.lineTo(AX, AXIS_END);
  ctx.stroke();

  // bar across the axis, and the cross near the bottom
  ctx.lineWidth = BAR.w;
  ctx.beginPath();
  ctx.moveTo(AX - BAR.half, BAR.y);
  ctx.lineTo(AX + BAR.half, BAR.y);
  ctx.moveTo(AX - CROSS.half, CROSS.y);
  ctx.lineTo(AX + CROSS.half, CROSS.y);
  ctx.stroke();

  // thin diamond and circles
  ctx.lineWidth = THIN;
  ctx.beginPath();
  ctx.moveTo(AX, CY - DIAMOND);
  ctx.lineTo(AX + DIAMOND, CY);
  ctx.lineTo(AX, CY + DIAMOND);
  ctx.lineTo(AX - DIAMOND, CY);
  ctx.closePath();
  ctx.stroke();
  for (const r of CIRCLES) {
    ctx.beginPath();
    ctx.arc(AX, CY, r, 0, TAU);
    ctx.stroke();
  }

  // inverted triangle
  ctx.lineWidth = TRI.w;
  ctx.beginPath();
  ctx.moveTo(AX - TRI.half, TRI.top);
  ctx.lineTo(AX + TRI.half, TRI.top);
  ctx.lineTo(AX, TRI.apex);
  ctx.closePath();
  ctx.stroke();

  // slashed ring and the tiny dots
  ctx.lineWidth = RING.w;
  ctx.beginPath();
  ctx.arc(AX, CY, RING.r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = SLASH.w;
  ctx.beginPath();
  const s = SLASH.r * Math.SQRT1_2;
  ctx.moveTo(AX - s, CY - s);
  ctx.lineTo(AX + s, CY + s);
  ctx.stroke();
  ctx.lineWidth = 1.3;
  for (const d of TINY) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.stroke();
  }

  // ring and ball below
  ctx.lineWidth = LOWER_RING.w;
  ctx.beginPath();
  ctx.arc(AX, LOWER_RING.y, LOWER_RING.r, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(AX, BALL.y, BALL.r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Cubic Hermite from (x0, v0) at u=0 to (0, 0) at u=1 over `secs`.
function hermite(x0, v0, secs, u) {
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  return h00 * x0 + h10 * secs * v0;
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: [366, 178, 268, 548],
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.cyc = restCycle({ hold: HOLD, away: AWAY });
    S.mode = 'cycle'; // cycle | live | home
    S.swing = 0;
    S.w = 0; // angular velocity, radians per second
    S.side = 1;
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(S.dt, 0.1);

    if (S.live && S.mode !== 'live') {
      if (S.mode === 'cycle' && S.cyc.phase === 'away') {
        // keep the ambient swing's speed as the cursor takes over
        const u = S.cyc.u;
        const env = Math.sin(Math.PI * u);
        const dEnv = Math.PI * Math.cos(Math.PI * u);
        const ph = TAU * SWINGS * u;
        S.w = (S.side * SWING * (dEnv * Math.sin(ph) + env * TAU * SWINGS * Math.cos(ph))) / AWAY;
      } else if (S.mode === 'cycle') S.w = 0;
      S.mode = 'live';
    } else if (!S.live && S.mode === 'live') {
      S.mode = 'home';
      S.homeU = 0;
      S.from = [S.swing, S.w];
    }

    if (S.mode === 'live') {
      const dx = S.mouseX - PIVOT[0];
      const dy = Math.max(60, S.mouseY - PIVOT[1]);
      const target = clamp(Math.atan2(-dx, dy) * 0.7, -REACH, REACH);
      S.w += (-SPRING * (S.swing - target) - DAMP * S.w) * dt;
      S.swing += S.w * dt;
    } else if (S.mode === 'home') {
      S.homeU = Math.min(1, S.homeU + dt / HOME);
      S.swing = hermite(S.from[0], S.from[1], HOME, S.homeU);
      if (S.homeU >= 1) {
        S.swing = S.w = 0;
        S.mode = 'cycle';
        S.cyc = restCycle({ hold: HOLD, away: AWAY });
      }
    } else {
      const c = S.cyc;
      c.step(S.dt);
      if (c.turned && c.phase === 'away') S.side = -S.side;
      S.swing =
        c.phase === 'away' ? S.side * SWING * Math.sin(Math.PI * c.u) * Math.sin(TAU * SWINGS * c.u) : 0;
    }

    draw(p, S, S.swing);

    if (S.mode === 'cycle' && S.cyc.phase === 'hold') S.sleep(S.cyc.left);
  },
});
