// S02-557 sigil
// A dark sigil hung on a vertical axis: an inverted triangle over a diamond and
// two thin circles, a slashed ring at the center, a ring and a dot below. After
// a 15s rest, over 36s the whole sigil swings from the top of its axis like a
// pendulum (three swings that ease in and out), the slash in the center turns
// slowly with the two small circles at its ends, and the ring and the dot at
// the bottom bounce off each other, the diamond's point and the bottom line.
// It all lands back on the original. With someone at the page it hangs toward
// the cursor on a springy pendulum while the slash and the bouncing carry on,
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
const TINY = { r: 43.8, size: 3.2 }; // the small circles at the slash's ends
const LOWER_RING = { y: 610, r: 15.5, w: 4 };
const BALL = { y: 654.5, r: 10 };
const CROSS = { y: 675, half: 13, w: 2.6 };

// The ring and the dot bounce along the axis between the diamond's lower point
// and the bottom line. Positions are their centers' y.
const VERTEX = CY + DIAMOND;
const RING_OUT = LOWER_RING.r + LOWER_RING.w / 2;
const Y1_MIN = VERTEX + 0.7 + RING_OUT;
const Y2_MAX = CROSS.y - CROSS.w / 2 - BALL.r;
const GAP = RING_OUT + BALL.r; // closest the two centers get
const M1 = 1.5; // masses, ring and dot
const M2 = 1;
const KICK = [16, -12]; // px per second, at the start of a bounce

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;
const HOME = 6; // easing home after someone leaves

const TURN = Math.PI; // half turn of the slash over the excursion; it looks the same
const TURN_SPEED = 0.15; // rad per second while someone is at the page
const BLEND = 6; // seconds at the end of the excursion spent settling the bounce
const SWING = 0.2; // radians, peak of the ambient swing
const SWINGS = 3;
const REACH = 0.4; // radians, most the cursor hangs it over
const SPRING = 12; // per second squared
const DAMP = 3.5; // per second
const TAU = Math.PI * 2;
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function draw(p, S, swing, tw, y1, y2) {
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

  // slashed ring; the slash and the small circles at its ends turn together
  ctx.lineWidth = RING.w;
  ctx.beginPath();
  ctx.arc(AX, CY, RING.r, 0, TAU);
  ctx.stroke();
  ctx.save();
  ctx.translate(AX, CY);
  ctx.rotate(tw);
  ctx.lineWidth = SLASH.w;
  ctx.beginPath();
  const s = SLASH.r * Math.SQRT1_2;
  ctx.moveTo(-s, -s);
  ctx.lineTo(s, s);
  ctx.stroke();
  ctx.lineWidth = 1.3;
  const t = TINY.r * Math.SQRT1_2;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(k * t, k * t, TINY.size, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  // ring and ball below
  ctx.lineWidth = LOWER_RING.w;
  ctx.beginPath();
  ctx.arc(AX, y1, LOWER_RING.r, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(AX, y2, BALL.r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Cubic Hermite from (x0, v0) at u=0 to (0, 0) at u=1 over `secs`.
function hermite(x0, v0, secs, u) {
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1;
  const h10 = u ** 3 - 2 * u ** 2 + u;
  return h00 * x0 + h10 * secs * v0;
}

// Runs the bounce forward by dt seconds: elastic hits between the ring and the
// dot, and against the diamond's point (top) and the bottom line.
function bounce(b, dt) {
  const n = Math.ceil(dt * 240);
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    b.y1 += b.v1 * h;
    b.y2 += b.v2 * h;
    if (b.y1 < Y1_MIN) [b.y1, b.v1] = [Y1_MIN, Math.abs(b.v1)];
    if (b.y2 > Y2_MAX) [b.y2, b.v2] = [Y2_MAX, -Math.abs(b.v2)];
    if (b.y2 - b.y1 < GAP) {
      const over = (GAP - (b.y2 - b.y1)) / 2;
      b.y1 -= over;
      b.y2 += over;
      if (b.v1 > b.v2) {
        const v1 = ((M1 - M2) * b.v1 + 2 * M2 * b.v2) / (M1 + M2);
        const v2 = ((M2 - M1) * b.v2 + 2 * M1 * b.v1) / (M1 + M2);
        [b.v1, b.v2] = [v1, v2];
      }
    }
  }
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
    S.tw = 0; // turn of the slash
    S.bounceAt = 0; // how far the bounce has settled onto its rest spots
    S.b = { y1: LOWER_RING.y, y2: BALL.y, v1: 0, v2: 0 };
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(S.dt, 0.1);
    const b = S.b;

    if (S.live && S.mode !== 'live') {
      if (S.mode === 'cycle' && S.cyc.phase === 'away') {
        // keep the ambient swing's speed as the cursor takes over
        const u = S.cyc.u;
        const env = Math.sin(Math.PI * u);
        const dEnv = Math.PI * Math.cos(Math.PI * u);
        const ph = TAU * SWINGS * u;
        S.w = (S.side * SWING * (dEnv * Math.sin(ph) + env * TAU * SWINGS * Math.cos(ph))) / AWAY;
      } else if (S.mode === 'cycle') {
        S.w = 0;
        [b.v1, b.v2] = [S.side * KICK[0], S.side * KICK[1]];
      }
      S.mode = 'live';
    } else if (!S.live && S.mode === 'live') {
      S.mode = 'home';
      S.homeU = 0;
      S.from = [S.swing, S.w, S.tw, b.y1, b.y2];
      S.homeTw = Math.round(S.tw / Math.PI) * Math.PI;
    }

    if (S.mode === 'live') {
      const dx = S.mouseX - PIVOT[0];
      const dy = Math.max(60, S.mouseY - PIVOT[1]);
      const target = clamp(Math.atan2(-dx, dy) * 0.7, -REACH, REACH);
      S.w += (-SPRING * (S.swing - target) - DAMP * S.w) * dt;
      S.swing += S.w * dt;
      S.tw += TURN_SPEED * dt;
      bounce(b, dt);
    } else if (S.mode === 'home') {
      S.homeU = Math.min(1, S.homeU + dt / HOME);
      const e = smoother(S.homeU);
      S.swing = hermite(S.from[0], S.from[1], HOME, S.homeU);
      S.tw = S.from[2] + (S.homeTw - S.from[2]) * e;
      b.y1 = S.from[3] + (LOWER_RING.y - S.from[3]) * e;
      b.y2 = S.from[4] + (BALL.y - S.from[4]) * e;
      if (S.homeU >= 1) {
        S.swing = S.w = S.tw = S.bounceAt = 0;
        [b.y1, b.y2, b.v1, b.v2] = [LOWER_RING.y, BALL.y, 0, 0];
        S.mode = 'cycle';
        S.cyc = restCycle({ hold: HOLD, away: AWAY });
      }
    } else {
      const c = S.cyc;
      c.step(S.dt);
      if (c.turned && c.phase === 'away') {
        S.side = -S.side;
        [b.y1, b.y2] = [LOWER_RING.y, BALL.y];
        [b.v1, b.v2] = [S.side * KICK[0], S.side * KICK[1]];
      }
      const away = c.phase === 'away';
      S.swing = away ? S.side * SWING * Math.sin(Math.PI * c.u) * Math.sin(TAU * SWINGS * c.u) : 0;
      S.tw = away ? S.side * TURN * c.k : 0;
      if (away) bounce(b, dt);
      else [b.y1, b.y2, b.v1, b.v2] = [LOWER_RING.y, BALL.y, 0, 0];
      S.bounceAt = away ? smoother(clamp((c.u - (1 - BLEND / AWAY)) / (BLEND / AWAY), 0, 1)) : 0;
    }

    // the last seconds of the excursion settle the bounce onto its rest spots
    const e = S.mode === 'cycle' ? S.bounceAt : 0;
    const y1 = b.y1 + (LOWER_RING.y - b.y1) * e;
    const y2 = b.y2 + (BALL.y - b.y2) * e;
    draw(p, S, S.swing, S.tw, y1, y2);

    if (S.mode === 'cycle' && S.cyc.phase === 'hold') S.sleep(S.cyc.left);
  },
});
