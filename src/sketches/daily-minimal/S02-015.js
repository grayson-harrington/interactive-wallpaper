// S02-015 moon phases
// Seven moons in a row, waxing from a new-moon ring to full. After a 15s rest
// every moon advances one phase at a time, twelve quick steps in about 40s,
// so the sequence rolls left along the row: the full moon wanes (lit on the
// other side) back through the crescents to a ring, and after the twelfth
// step the row is the original again. The moons slide as
// their shapes change so the gaps between them stay equal, with the middle
// moon held at the center. With someone at the page, moving the cursor
// sideways scrubs the phases; when they leave, the row eases to the nearest
// step and rolls on to the original.
import { dmSketch } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 22;
const ringGray = 245;

// Geometry, measured: 100px moons on y=640. XS are the original's centers,
// used only to give each moon its own patch of paper; the layout below
// places them.
const CY = 640;
const XS = [291, 428, 524, 634, 731, 855, 989];
const R = 50;
const RING = 5;

// Layout: an equal GAP between the moons' visible edges, the middle moon's
// visible center at MID. GAP keeps the rest pose's span close to the
// original's.
const GAP = 39;
const MID = 640;

// Phase keyframes, lit on the left, as [m, k]: the terminator crosses the
// moon's middle row at x offset m and bends with signed curvature k. k > 0
// cuts a disc of radius 1/k out of the moon (crescent), k < 0 keeps only its
// overlap with one (gibbous), k = 0 is a straight edge. Fitted to the
// original; the first and last are the empty and full moon.
const KEYS = [
  [-50, 0.02],
  [-30, 0.02137],
  [-20.29, 0.02071],
  [0, 0],
  [35.25, -0.01596],
  [43.56, -0.01645],
  [50, -0.02],
];
const STEPS = 12; // a full cycle: waxing 0..6, then waning 6..12 mirrored

// Timing, in seconds.
const HOLD = 15; // on the original
const MOVE = 1.8; // one phase step
const PAUSE = 1.5; // between steps
const SETTLE = 6; // to the nearest step after someone leaves
const SCRUB = 110; // px of cursor travel per phase step

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (x) => ((x % STEPS) + STEPS) % STEPS;

// Paper for the lit parts, covering the whole row.
const TEX = [XS[0] - R - 2, CY - R - 2, XS[6] - XS[0] + 2 * R + 4, 2 * R + 4];

function paperTexture() {
  const [, , w, h] = TEX;
  const tex = dotPaperCanvas(w, h, { base: 240, gray: [185, 255], alpha: [60, 140], density: 1 });
  const flecks = paperCanvas(w, h, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 140),
    speckAlpha: [50, 170],
    speckGray: [20, 110],
    speckSize: [0.8, 2.2],
  });
  tex.getContext('2d').drawImage(flecks, 0, 0);
  return tex;
}

// Terminator [m, k] and side at cycle position q in [0, STEPS).
function phaseAt(q) {
  const mirror = q > STEPS / 2;
  const s = mirror ? STEPS - q : q;
  const i = Math.min(Math.floor(s), KEYS.length - 2);
  const f = s - i;
  const [m0, k0] = KEYS[i];
  const [m1, k1] = KEYS[i + 1];
  return [m0 + (m1 - m0) * f, k0 + (k1 - k0) * f, mirror];
}

// Visible x extent [left, right] of a moon at cycle position q, relative to
// its center: the lit part, widened to the full disc as the ring fades in.
// Worked out exactly from the circles, so it changes smoothly with q.
function extentAt(q) {
  const [m, k, mirror] = phaseAt(q);
  let lo = 0;
  let hi = 0;
  if (m > -R + 0.05) {
    lo = -R;
    hi = Math.min(R, m);
    if (Math.abs(k) > 1e-4) {
      // the terminator circle: center c on the axis, radius rho
      const rho = Math.abs(1 / k);
      const c = m + 1 / k;
      // x where it crosses the moon's rim, if it does
      const meet = Math.abs(R - rho) < Math.abs(c) && Math.abs(c) < R + rho ? (R * R - rho * rho + c * c) / (2 * c) : null;
      if (k > 0) {
        // crescent: the rim minus that circle; the tips are the crossings
        hi = Math.abs(R - c) < rho && meet !== null ? meet : R;
      } else if (Math.abs(-R - c) >= rho && meet !== null) {
        // gibbous: the rim within that circle; it may not reach the far side
        lo = meet;
      }
    }
  }
  if (mirror) [lo, hi] = [-hi, -lo];
  const ring = q < 1 ? 1 - q : q > STEPS - 1 ? q - (STEPS - 1) : 0;
  return [lo + (-R - lo) * ring, hi + (R - hi) * ring];
}

// Moon centers for this frame.
function centers(qs) {
  const ext = qs.map(extentAt);
  const xs = new Array(XS.length);
  const mid = 3;
  xs[mid] = MID - (ext[mid][0] + ext[mid][1]) / 2;
  for (let i = mid + 1; i < XS.length; i++) xs[i] = xs[i - 1] + ext[i - 1][1] + GAP - ext[i][0];
  for (let i = mid - 1; i >= 0; i--) xs[i] = xs[i + 1] + ext[i + 1][0] - GAP - ext[i][1];
  return xs;
}

function drawMoon(ctx, tex, i, cx, q) {
  const [m, k, mirror] = phaseAt(q);
  if (m > -R + 0.05) {
    const base = ctx.getTransform();
    ctx.save();
    ctx.translate(cx, CY);
    if (mirror) ctx.scale(-1, 1);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    if (k > 1e-4) {
      ctx.rect(-R - 1, -R - 1, 2 * R + 2, 2 * R + 2);
      ctx.arc(m + 1 / k, 0, 1 / k, 0, Math.PI * 2);
      ctx.clip('evenodd');
    } else if (k < -1e-4) {
      ctx.arc(m + 1 / k, 0, -1 / k, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.rect(-R - 1, -R - 1, m + R + 1, 2 * R + 2);
      ctx.clip();
    }
    ctx.setTransform(base);
    // each moon carries its own patch of paper
    const sx = XS[i] - R - 2 - TEX[0];
    ctx.drawImage(tex, sx, 0, 2 * R + 4, 2 * R + 4, cx - R - 2, CY - R - 2, 2 * R + 4, 2 * R + 4);
    ctx.restore();
  }
  // the new moon is an outline, faded in around the empty phase
  const ring = q < 1 ? 1 - q : q > STEPS - 1 ? q - (STEPS - 1) : 0;
  if (ring > 0) {
    ctx.strokeStyle = `rgba(${ringGray},${ringGray},${ringGray},${ring})`;
    ctx.lineWidth = RING;
    ctx.beginPath();
    ctx.arc(cx, CY, R - RING / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// The rest row's bounds, made symmetric about MID so the harness centers the
// middle moon on screen.
const ART = (() => {
  const qs = XS.map((_, i) => i);
  const xs = centers(qs);
  const ext = qs.map(extentAt);
  const half = Math.max(MID - (xs[0] + ext[0][0]), xs[6] + ext[6][1] - MID);
  return [MID - half, CY - R, 2 * half, 2 * R];
})();

function draw(p, S) {
  const ctx = p.drawingContext;
  const qs = XS.map((_, i) => wrap(i + S.pos));
  const xs = centers(qs);
  for (let i = 0; i < XS.length; i++) drawMoon(ctx, S.tex, i, xs[i], qs[i]);
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: ART, // the rest row, widened to be symmetric about the middle moon
  scale: 0.7, // a long thin row reads too big at equal area; ~60% of the width
  bg,
  fps: 30,
  init(p, S) {
    S.tex = paperTexture();
    S.pos = 0; // phase steps advanced, fractional while moving
    S.state = 'hold';
    S.t = 0;
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;

    if (S.live) {
      if (S.state !== 'scrub') {
        S.state = 'scrub';
        S.anchor = [S.pos, S.mouseX];
      }
      const target = S.anchor[0] + (S.mouseX - S.anchor[1]) / SCRUB;
      S.pos += (target - S.pos) * Math.min(1, 8 * dt);
    } else if (S.state === 'scrub') {
      [S.state, S.t, S.from, S.to] = ['settle', 0, S.pos, Math.round(S.pos)];
    }

    if (S.state === 'move' || S.state === 'settle') {
      const dur = S.state === 'move' ? MOVE : SETTLE;
      S.t = Math.min(1, S.t + dt / dur);
      S.pos = S.from + (S.to - S.from) * smoother(S.t);
      if (S.t >= 1) {
        S.pos = wrap(S.to);
        S.state = 'hold';
        S.armed = false;
      }
    }

    draw(p, S);

    if (S.state === 'hold') {
      if (!S.armed) {
        S.armed = true;
        // rest on the original, only pause between the steps away from it
        p.schedule(() => {
          if (S.state !== 'hold') return;
          [S.state, S.t, S.from, S.to] = ['move', 0, S.pos, S.pos + 1];
          p.loop();
        }, (S.pos === 0 ? HOLD : PAUSE) * 1000);
      }
      p.noLoop();
    } else if (S.state === 'scrub') {
      const still = S.mouseX === S.lastMouse[0] && Math.abs(S.anchor[0] + (S.mouseX - S.anchor[1]) / SCRUB - S.pos) < 1e-3;
      if (still) {
        p.noLoop();
        // look again later: input going quiet doesn't wake the sketch
        if (!S.polling) {
          S.polling = true;
          p.schedule(() => {
            S.polling = false;
            p.loop();
          }, 5000);
        }
      }
    }
    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
  },
  onActivate(p, S) {
    S.armed = false;
    S.polling = false;
  },
});
