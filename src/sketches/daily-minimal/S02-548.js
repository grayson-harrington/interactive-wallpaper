// S02-548 balanced bauhaus
// A tilted black rectangle cut by a long diagonal line and its thin twin, five
// short lines, a bar with a ball resting on it, and two dots. Every line turns
// light where it crosses the rectangle. After a 15s rest, over 36s the
// rectangle turns half a revolution (each time the other way round from the
// last) while the diagonal line and its twin slide sideways back and forth and
// the five short lines drift up and down and spread apart, so the slit and the
// lines sweep across the rectangle, all landing back on the original. With
// someone at the page the rectangle turns to point at the cursor, the diagonal
// line slides sideways toward it, the five lines keep drifting, and everything
// eases home when they leave.
import { dmSketch, restCycle } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 239;
const ink = 34;

// Geometry, measured.
const RECT = { x: 531, y: 489.7, w: 291.3, h: 163.3, rot: Math.PI / 4 };
const LINE_A = [251, 670];
const LINE_B = [750, 438];
const LINE_W = 4.2;
const TWIN_A = [323, 649];
const TWIN_B = [706, 471];
const TWIN_W = 1.2;
const FIVE = { x0: 524, x1: 624, y0: 404.4, step: 8.8, n: 5, w: 1.8 };
const BAR = { x: 355.75, y: 580, w: 214, h: 27, rot: (20.5 * Math.PI) / 180 };
const BALL = { x: 291, y: 521, r: 19 };
const DOTS = [
  { x: 435, y: 639, r: 8 },
  { x: 729, y: 431, r: 6 },
];
const PAPER = [240, 320, 520, 360]; // texture box covering every pose

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;
const HOME = 6; // easing home after someone leaves

const FOLLOW = 2.5; // per second
const REACH = 100; // most the line slides sideways toward the cursor, px
const SWAY = 55; // ambient sideways slide of the diagonal, px
const DRIFT = 40; // ambient vertical drift of the five lines, px
const SPREAD = 0.6; // how much their spacing opens at the extremes
const DRIFT_PERIOD = 12; // seconds per drift while someone is at the page
const TAU = Math.PI * 2;
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// unit vectors along and across the diagonal
const LEN = Math.hypot(LINE_B[0] - LINE_A[0], LINE_B[1] - LINE_A[1]);
const UX = (LINE_B[0] - LINE_A[0]) / LEN;
const UY = (LINE_B[1] - LINE_A[1]) / LEN;
const NX = -UY;
const NY = UX;

function paper() {
  const [, , w, h] = PAPER;
  const tex = dotPaperCanvas(w, h, { base: ink, gray: [0, 90], alpha: [40, 110], density: 1 });
  const flecks = paperCanvas(w, h, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 320),
    speckAlpha: [90, 210],
    speckGray: [200, 255],
    speckSize: [0.8, 2],
  });
  tex.getContext('2d').drawImage(flecks, 0, 0);
  return tex;
}

function rectPath(ctx, r, rot) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.rect(-r.w / 2, -r.h / 2, r.w, r.h);
  ctx.restore();
}

// All the lines, in one color.
function lines(ctx, off, fl) {
  ctx.lineCap = 'butt';
  ctx.lineWidth = LINE_W;
  ctx.beginPath();
  ctx.moveTo(LINE_A[0] + NX * off, LINE_A[1] + NY * off);
  ctx.lineTo(LINE_B[0] + NX * off, LINE_B[1] + NY * off);
  ctx.stroke();
  ctx.lineWidth = TWIN_W;
  ctx.beginPath();
  ctx.moveTo(TWIN_A[0] + NX * off, TWIN_A[1] + NY * off);
  ctx.lineTo(TWIN_B[0] + NX * off, TWIN_B[1] + NY * off);
  ctx.stroke();
  ctx.lineWidth = FIVE.w;
  ctx.beginPath();
  const mid = FIVE.y0 + ((FIVE.n - 1) * FIVE.step) / 2;
  for (let i = 0; i < FIVE.n; i++) {
    const y = mid + (i - (FIVE.n - 1) / 2) * FIVE.step * (1 + SPREAD * fl * fl) + fl * DRIFT;
    ctx.moveTo(FIVE.x0, y);
    ctx.lineTo(FIVE.x1, y);
  }
  ctx.stroke();
}

function draw(p, S, rot, off, fl) {
  const ctx = p.drawingContext;
  const [px, py] = PAPER;
  const dark = `rgb(${ink},${ink},${ink})`;
  const light = `rgb(${bg},${bg},${bg})`;

  // grainy dark shapes: the rectangle, the bar and the ball
  rectPath(ctx, RECT, rot);
  ctx.save();
  ctx.clip();
  ctx.drawImage(S.paper, px, py);
  ctx.restore();

  ctx.save();
  ctx.translate(BAR.x, BAR.y);
  ctx.rotate(BAR.rot);
  ctx.beginPath();
  ctx.rect(-BAR.w / 2, -BAR.h / 2, BAR.w, BAR.h);
  ctx.restore();
  ctx.save();
  ctx.clip();
  ctx.drawImage(S.paper, px, py);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(BALL.x, BALL.y, BALL.r, 0, TAU);
  ctx.save();
  ctx.clip();
  ctx.drawImage(S.paper, px, py);
  ctx.restore();

  ctx.fillStyle = dark;
  for (const d of DOTS) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, TAU);
    ctx.fill();
  }

  // the lines: dark, then light where they cross the rectangle
  ctx.strokeStyle = dark;
  lines(ctx, off, fl);
  ctx.save();
  rectPath(ctx, RECT, rot);
  ctx.clip();
  ctx.strokeStyle = light;
  lines(ctx, off, fl);
  ctx.restore();
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: [250, 329, 500, 343],
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.paper = paper();
    S.cyc = restCycle({ hold: HOLD, away: AWAY });
    S.mode = 'cycle'; // cycle | live | home
    S.side = 1;
    S.rot = 0; // turn of the rectangle beyond its rest pose
    S.off = 0; // sideways slide of the diagonal
    S.fl = 0; // drift of the five lines, -1..1
    S.lt = 0; // clock for the drift while someone is at the page
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(S.dt, 0.1);

    if (S.live && S.mode !== 'live') {
      // the drift carries on from where the cycle had it
      if (S.mode === 'cycle' && S.cyc.phase === 'away') S.lt = 3 * S.cyc.k * DRIFT_PERIOD;
      S.mode = 'live';
    } else if (!S.live && S.mode === 'live') {
      S.mode = 'home';
      S.homeU = 0;
      S.from = [S.rot, S.off, S.fl];
      S.homeRot = Math.round(S.rot / Math.PI) * Math.PI; // a half turn looks the same
    }

    if (S.mode === 'live') {
      const k = Math.min(1, FOLLOW * dt);
      S.lt += dt;
      S.fl = Math.sin((TAU * S.lt) / DRIFT_PERIOD);
      const dx = S.mouseX - RECT.x;
      const dy = S.mouseY - RECT.y;
      S.off += (clamp(dx * NX + dy * NY, -REACH, REACH) - S.off) * k;
      if (Math.hypot(dx, dy) > 30) {
        // point the long side at the cursor; a half turn looks the same
        let target = Math.atan2(dy, dx) - RECT.rot;
        target += Math.round((S.rot - target) / Math.PI) * Math.PI;
        S.rot += (target - S.rot) * k;
      }
    } else if (S.mode === 'home') {
      S.homeU = Math.min(1, S.homeU + dt / HOME);
      const e = smoother(S.homeU);
      S.rot = S.from[0] + (S.homeRot - S.from[0]) * e;
      S.off = S.from[1] * (1 - e);
      S.fl = S.from[2] * (1 - e);
      if (S.homeU >= 1) {
        S.rot = S.off = S.fl = 0;
        S.mode = 'cycle';
        S.cyc = restCycle({ hold: HOLD, away: AWAY });
      }
    } else {
      const c = S.cyc;
      c.step(S.dt);
      if (c.turned && c.phase === 'away') S.side = -S.side;
      const away = c.phase === 'away';
      S.rot = away ? S.side * Math.PI * c.k : 0;
      S.off = away ? SWAY * Math.sin(TAU * 2 * c.k) : 0;
      S.fl = away ? Math.sin(TAU * 3 * c.k) : 0;
    }

    draw(p, S, RECT.rot + S.rot, S.off, S.fl);

    if (S.mode === 'cycle' && S.cyc.phase === 'hold') S.sleep(S.cyc.left);
  },
});
