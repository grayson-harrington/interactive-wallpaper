// S02-029 swirl ring
// A paper-white ring cut into twelve crescents that swirl into a dark center.
// Every 30s the swirl breathes: the ring of circles behind it draws in so the
// vortex winds tight, then swings out loose with the hole wide open, turning
// two petals round as it goes and landing back on the original. With someone
// at the page, the cursor's distance from the center sets how tight it winds,
// and moving sideways turns it a little; it settles back when they leave.
import { dmSketch } from './harness.js';
import { paperCanvas } from '../../lib/paper.js';

const bg = 22;
const ink = 241;

// Geometry, fitted to the original (1.3% of pixels differ, all on edges):
// crescent j is circle A minus circle B. A sits DA from the center at angle
// A0 + 30j with radius RA; B sits DB out, DL further round, with radius RB.
// Breathing scales DA and DB by k and keeps each circle's outer reach
// (D + R) fixed, so the ring's size holds while the swirl tightens.
const CX = 639.5;
const CY = 601;
const N = 12;
const A0 = (21 * Math.PI) / 180;
const DL = (20.66 * Math.PI) / 180;
const DA = 107.56;
const DB = 102.56;
const REACH_A = 107.56 + 185.9;
const REACH_B = 102.56 + 186.2;
const STEP = (2 * Math.PI) / N;

// Breathing: k runs 1 -> 1+K_AMP -> 1-K_AMP -> 1 over MOVE seconds while the
// ring turns TURN, then holds HOLD seconds.
const K_AMP = 0.35;
const TURN = 2 * STEP;
const MOVE = 24;
const HOLD = 6;

// Cursor: k from 1.4 at the center to 0.65 at FAR px out; sideways motion
// turns the ring TURN_PX radians per px. Both ease in at EASE per second,
// with no momentum, so the ring follows the hand calmly.
const K_NEAR = 1.4;
const K_FAR = 0.65;
const FAR = 480;
const TURN_PX = 0.0006;
const EASE = 1.5; // per second

const TAU = Math.PI * 2;
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Adds circle A minus circle B to the current path, centered on the origin.
function crescent(ctx, ax, ay, ra, bx, by, rb) {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  if (d >= ra + rb || d <= Math.abs(ra - rb)) return;
  const a = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - a * a));
  const mx = ax + (a * dx) / d;
  const my = ay + (a * dy) / d;
  const p1x = mx - (h * dy) / d;
  const p1y = my + (h * dx) / d;
  const p2x = mx + (h * dy) / d;
  const p2y = my - (h * dx) / d;
  // A's arc away from B, then back along B's arc inside A
  const a1 = Math.atan2(p1y - ay, p1x - ax);
  const a2 = Math.atan2(p2y - ay, p2x - ax);
  // both arcs bulge the way from B's center toward A's
  const back = Math.atan2(-dy, -dx);
  const b2 = Math.atan2(p2y - by, p2x - bx);
  const b1 = Math.atan2(p1y - by, p1x - bx);
  const ccwA = !between(back, a1, a2);
  const ccwB = !between(back, b2, b1);
  ctx.moveTo(p1x, p1y);
  ctx.arc(ax, ay, ra, a1, a2, ccwA);
  ctx.arc(bx, by, rb, b2, b1, ccwB);
  ctx.closePath();
}

// Is angle t on the clockwise (increasing) sweep from s to e?
function between(t, s, e) {
  const span = (((e - s) % TAU) + TAU) % TAU;
  const off = (((t - s) % TAU) + TAU) % TAU;
  return off <= span;
}

function draw(p, S, k, rot) {
  const ctx = p.drawingContext;
  const da = DA * k;
  const db = DB * k;
  const ra = REACH_A - da;
  const rb = REACH_B - db;
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let j = 0; j < N; j++) {
    const ta = A0 + j * STEP;
    const tb = ta + DL;
    crescent(ctx, da * Math.cos(ta), da * Math.sin(ta), ra, db * Math.cos(tb), db * Math.sin(tb), rb);
  }
  ctx.fillStyle = S.paper;
  ctx.fill();
  ctx.restore();
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: [CX - REACH_A, CY - REACH_A, 2 * REACH_A, 2 * REACH_A],
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    const size = 2 * Math.ceil(REACH_A + 4);
    const tex = paperCanvas(size, size, { base: ink, grainAlpha: [0, 12], specks: 0 });
    const flecks = paperCanvas(size, size, {
      transparent: true,
      grainAlpha: [0, 0],
      specks: Math.round((size * size) / 260),
      speckAlpha: [50, 170],
      speckGray: [20, 110],
      speckSize: [0.8, 2.2],
    });
    tex.getContext('2d').drawImage(flecks, 0, 0);
    S.paper = p.drawingContext.createPattern(tex, 'no-repeat');
    S.paper.setTransform(new DOMMatrix([1, 0, 0, 1, -size / 2, -size / 2]));

    S.mode = 'hold'; // hold | move | live | settle
    S.u = 0;
    S.twist = 1;
    S.rot = 0;
    S.rotTarget = 0;
    S.twistTarget = 1;
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    const ease = Math.min(1, EASE * dt);
    const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);

    if (S.live && mouseMoved && S.mode !== 'live') {
      if (S.mode === 'move') {
        const e = smoother(S.u);
        S.twist = 1 + K_AMP * Math.sin(TAU * e);
        S.rot = TURN * e;
      }
      S.rotTarget = S.rot;
      S.mode = 'live';
    }

    if (S.mode === 'move') {
      S.u += dt / MOVE;
      if (S.u >= 1) {
        S.u = 0;
        S.mode = 'hold';
      }
    } else if (S.mode === 'live' || S.mode === 'settle') {
      if (S.mode === 'live') {
        if (!S.live) {
          // home is the nearest turn that matches the original
          S.mode = 'settle';
          S.rotTarget = Math.round(S.rot / STEP) * STEP;
        }
        const d = Math.hypot(S.mouseX - CX, S.mouseY - CY);
        const target = clamp(K_NEAR - (d / FAR) * (K_NEAR - K_FAR), K_FAR, K_NEAR);
        S.twistTarget = target;
        S.twist += (target - S.twist) * ease;
        if (S.mode === 'live' && Number.isFinite(S.lastMouse[0])) S.rotTarget += (S.mouseX - S.lastMouse[0]) * TURN_PX;
      }
      S.rot += (S.rotTarget - S.rot) * ease;
      if (S.mode === 'settle') {
        S.twist += (1 - S.twist) * ease;
        if (Math.abs(S.rotTarget - S.rot) < 0.0005 && Math.abs(S.twist - 1) < 0.001) {
          S.rot = 0;
          S.rotTarget = 0;
          S.twist = 1;
          S.mode = 'hold';
        }
      }
    }

    // live but still: rest until the cursor moves or the page goes idle
    const still =
      S.mode === 'live' &&
      !mouseMoved &&
      Math.abs(S.rotTarget - S.rot) < 0.0005 &&
      Math.abs(S.twist - S.twistTarget) < 0.001;

    let k = S.twist;
    let rot = S.rot;
    if (S.mode === 'move') {
      const e = smoother(S.u);
      k = 1 + K_AMP * Math.sin(TAU * e);
      rot = TURN * e;
    }
    draw(p, S, k, rot);

    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
    if (S.mode === 'hold' || still) {
      if (!S.armed) {
        S.armed = true;
        p.schedule(() => {
          S.armed = false;
          if (S.mode === 'hold') {
            S.mode = 'move';
            S.u = 0;
          }
          p.loop();
        }, HOLD * 1000);
      }
      if (!mouseMoved) p.noLoop();
    }
  },
  onActivate(p, S) {
    S.armed = false;
  },
});
