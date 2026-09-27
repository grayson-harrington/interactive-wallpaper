// S02-341 wavy lines
// Thirty-five white lines combed down a dark square, each folding into a
// near-flat run where it crosses a pleat along the square's rising diagonal.
// After a 15s rest the fabric stirs for 30s: the pleat sways, tilts, loosens
// and tightens as a slow ripple runs along it, while a soft bulge drifts
// through the lines, then everything settles back exactly where it was. With
// someone at the page, the cursor pushes the lines aside like a finger
// through combed hair, and they spring back when it leaves.
import { dmSketch, wanderer } from './harness.js';
import { paperCanvas } from '../../lib/paper.js';
import { LINES } from './S02-341.lines.js';

const bg = 22;
const ink = 241;

// Geometry, measured: lines 5.4px wide, cut by the square x 365-913,
// y 337-885. The lines themselves are traced from the original.
const SQ = [365, 337, 549, 549];
const WIDTH = 5.4;
const EXTEND = 160; // px past the square's edge, so the clip cuts them cleanly
const EXT_STEP = 8;
const EXT_BEND = 0.128; // px per EXT_STEP^2, curling the carried ends out past the edge

// The sway works across the pleat, in s = x + y, with w = x - y along it:
//   s -> S0 + (s - S0)(1 + stretch) + tilt (w - W0) + ripple sin(...)
// which keeps every line in order. Amplitudes are eased in and out over MOVE
// seconds; then the lines hold still for HOLD seconds.
const S0 = 1270;
const W0 = 28;
const STRETCH = 0.12;
const TILT = 0.12;
const RIPPLE = 40;
const WAVE = 900; // in w
const MOVE = 30;
const HOLD = 15;

// Bulge: each point moves straight away from the cursor by
// (distance) * BULGE * exp(-distance^2 / 2 BULGE_R^2): zero under the cursor,
// most (about 0.6 BULGE BULGE_R, ~50px) at BULGE_R out, gone by ~3 BULGE_R.
// Smooth everywhere, and with BULGE under 2.2 the lines never cross.
const BULGE = 0.75;
const BULGE_R = 110;
const BULGE_IN = 3; // per second
const BULGE_OUT = 1.5;
const FOLLOW = 12; // per second

const TAU = Math.PI * 2;
const smooth = (t) => t * t * (3 - 2 * t);

// [xs, ys] per line, each end carried on along its direction past the square,
// curling out through the nearest edge (a line hugging an edge would
// otherwise run along it).
function decode() {
  return LINES.map(([ex, ey]) => {
    const xs = [];
    const ys = [];
    let x = 0;
    let y = 0;
    const dx = ex.split(',').map(Number);
    const dy = ey.split(',').map(Number);
    for (let i = 0; i < dx.length; i++) {
      xs.push((x += dx[i]) / 10);
      ys.push((y += dy[i]) / 10);
    }
    const carry = (i, j, into) => {
      const ux = xs[i] - xs[j];
      const uy = ys[i] - ys[j];
      const d = Math.hypot(ux, uy);
      const [nx, ny] = outward(xs[i], ys[i]);
      const out = [];
      for (let k = EXT_STEP; k <= EXTEND; k += EXT_STEP) {
        const bend = EXT_BEND * (k / EXT_STEP) ** 2;
        out.push([xs[i] + (ux / d) * k + nx * bend, ys[i] + (uy / d) * k + ny * bend]);
      }
      into(out);
    };
    const back = Math.min(6, xs.length - 1);
    carry(0, back, (out) => {
      for (const [px, py] of out) {
        xs.unshift(px);
        ys.unshift(py);
      }
    });
    carry(xs.length - 1, xs.length - 1 - back, (out) => {
      for (const [px, py] of out) {
        xs.push(px);
        ys.push(py);
      }
    });
    return [Float32Array.from(xs), Float32Array.from(ys)];
  });
}

// Unit normal out through the square's edge nearest (x, y).
function outward(x, y) {
  const [sx, sy, sw, sh] = SQ;
  const gaps = [x - sx, sx + sw - x, y - sy, sy + sh - y];
  const i = gaps.indexOf(Math.min(...gaps));
  return [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ][i];
}

function draw(p, S) {
  const ctx = p.drawingContext;
  const [sx, sy, sw, sh] = SQ;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();
  ctx.strokeStyle = S.paper;
  ctx.lineWidth = WIDTH;
  ctx.lineJoin = 'round';

  const { stretch, tilt, ripple, phase } = S.sway;
  const swaying = stretch || tilt || ripple;
  const push = BULGE * smooth(S.bulge);
  const [mx, my] = S.bulgeAt;
  const inv = 1 / (2 * BULGE_R * BULGE_R);
  const reach2 = (3.5 * BULGE_R) ** 2;

  ctx.beginPath();
  for (const [xs, ys] of S.lines) {
    for (let i = 0; i < xs.length; i++) {
      let x = xs[i];
      let y = ys[i];
      if (swaying) {
        const w = x - y;
        const s =
          S0 + (x + y - S0) * (1 + stretch) + tilt * (w - W0) + ripple * Math.sin((TAU * (w - W0)) / WAVE + phase);
        x = (s + w) / 2;
        y = (s - w) / 2;
      }
      if (push) {
        const dx = x - mx;
        const dy = y - my;
        const r2 = dx * dx + dy * dy;
        if (r2 < reach2) {
          const k = push * Math.exp(-r2 * inv);
          x += dx * k;
          y += dy * k;
        }
      }
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: SQ,
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.lines = decode();
    const [sx, sy, sw, sh] = SQ;
    const tex = paperCanvas(sw, sh, { base: ink, grainAlpha: [0, 12], specks: 0 });
    const flecks = paperCanvas(sw, sh, {
      transparent: true,
      grainAlpha: [0, 0],
      specks: Math.round((sw * sh) / 140),
      speckAlpha: [50, 170],
      speckGray: [20, 110],
      speckSize: [0.8, 2.2],
    });
    tex.getContext('2d').drawImage(flecks, 0, 0);
    S.paper = p.drawingContext.createPattern(tex, 'no-repeat');
    S.paper.setTransform(new DOMMatrix([1, 0, 0, 1, sx, sy]));

    S.wander = wanderer(p, sx + sw / 2, sy + sh / 2, sw * 0.42, 0.18);
    S.mode = 'hold'; // hold | move
    S.u = 0;
    S.sway = { stretch: 0, tilt: 0, ripple: 0, phase: 0 };
    S.bulge = 0;
    S.bulgeAt = [0, 0];
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;

    let env = 0;
    if (S.mode === 'move') {
      S.u += dt / MOVE;
      if (S.u >= 1) {
        S.u = 0;
        S.mode = 'hold';
      } else {
        // sin^2 envelope: zero with zero slope at both ends
        env = Math.sin(Math.PI * S.u) ** 2;
      }
    }
    const u = S.u;
    S.sway.stretch = env * STRETCH * Math.sin(TAU * 2 * u);
    S.sway.tilt = env * TILT * Math.sin(TAU * u + 1);
    S.sway.ripple = env * RIPPLE;
    S.sway.phase = -TAU * 2 * u;

    // the bulge follows the cursor while it's over the square; in ambient the
    // wanderer carries a softer one through during the sway
    const [sx, sy, sw, sh] = SQ;
    const over =
      S.live && S.mouseX > sx - 40 && S.mouseX < sx + sw + 40 && S.mouseY > sy - 40 && S.mouseY < sy + sh + 40;
    let target = 0;
    let tx = S.bulgeAt[0];
    let ty = S.bulgeAt[1];
    if (over) {
      target = 1;
      tx = S.mouseX;
      ty = S.mouseY;
    } else if (!S.live && S.mode === 'move') {
      target = 0.7 * env;
      [tx, ty] = S.wander();
    }
    if (target > 0) {
      if (S.bulge === 0) S.bulgeAt = [tx, ty];
      S.bulgeAt[0] += (tx - S.bulgeAt[0]) * Math.min(1, FOLLOW * dt);
      S.bulgeAt[1] += (ty - S.bulgeAt[1]) * Math.min(1, FOLLOW * dt);
    }
    const rate = (target > S.bulge ? BULGE_IN : BULGE_OUT) * dt;
    S.bulge = target > S.bulge ? Math.min(target, S.bulge + rate) : Math.max(target, S.bulge - rate);
    const pushing = S.bulge !== target || (over && Math.hypot(S.mouseX - S.bulgeAt[0], S.mouseY - S.bulgeAt[1]) > 0.1);

    draw(p, S);

    const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);
    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
    if (S.mode === 'hold') {
      if (!S.armed) {
        S.armed = true;
        p.schedule(() => {
          S.armed = false;
          S.mode = 'move';
          S.u = 0;
          p.loop();
        }, HOLD * 1000);
      }
      if (!pushing && !mouseMoved) p.noLoop();
    }
  },
  onActivate(p, S) {
    S.armed = false;
  },
});
