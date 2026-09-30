// S02-338 lines to the horizon
// A window of white lines fanning toward a vanishing point far off to the
// right, bunching up toward a grainy white horizon at its foot. After a 15s
// rest, over 40s the lines flow toward the horizon (new ones slide in from
// the top) while the vanishing point sweeps sideways, and everything settles
// back to the original. The vanishing point stays level with the top of the
// horizon strip, which never moves, so the lines are always level where they
// reach it. With someone at the page the cursor's X sets the vanishing point,
// and the higher the cursor is above the horizon the faster the lines flow;
// when they leave the fan eases back and the lines settle onto the original.
import { dmSketch } from './harness.js';
import { paperCanvas } from '../../lib/paper.js';
import { pose } from './pose.js';

const bg = 22;
const ink = 250;

// Geometry, measured. The window; the lines are a fan through the vanishing
// point (VX, top of the horizon strip): line n meets x = X_REF that far
// above the strip (OFF, measured), and heads for the vanishing point from
// there.
const WIN = [325, 301, 631, 626];
const BAND_Y = 890; // the grainy horizon strip runs from here to the bottom
const VX = 2325;
const OFF = [
  549, 498.5, 452.5, 411, 373, 338.5, 307, 278.5, 252.5, 228.5, 207, 187.5, 169.5, 153.5, 138.5, 125.5, 111.5, 99.5, 88.5, 78.5, 69.5,
  61, 53.5, 46.5, 40, 34.5, 29.5, 24.5, 20.5, 16.5, 13, 9.5,
];
const TOP_RATIO = OFF[1] / OFF[0]; // beyond the measured lines they keep bunching
const BOTTOM_RATIO = 0.78;
const LAST = OFF.length - 1;
const X_REF = 330;
const LINE_W = 1.9;
const FIRST = -10; // lines drawn, by number: enough to fill the window
const LAST_DRAWN = 48;

// Timing, in seconds.
const HOLD = 15;
const AWAY = 40;
const FLOW = 6; // lines that slide past in one excursion
const SWEEP_X = 700; // how far the vanishing point sweeps, px
const FOLLOW = 2.5; // per second
const SETTLE = 6;

// The cursor: over the window it moves the vanishing point sideways by this factor.
const PULL_X = 3;
const FLOW_MIN = 0.1; // lines per second at the horizon
const FLOW_MAX = 1;

// How far above the strip line n meets X_REF, for a fractional line number:
// the measured ones in between, geometric beyond either end.
function offset(n) {
  if (n <= 0) return OFF[0] * TOP_RATIO ** n;
  if (n >= LAST) return OFF[LAST] * BOTTOM_RATIO ** (n - LAST);
  const j = Math.floor(n);
  return OFF[j] ** (1 - (n - j)) * OFF[j + 1] ** (n - j);
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function textures() {
  const [, , w, h] = WIN;
  const bandH = WIN[1] + h - BAND_Y;
  const band = paperCanvas(w, bandH, {
    base: 246,
    grainAlpha: [10, 22],
    specks: Math.round((w * bandH) / 90),
    speckAlpha: [80, 210],
    speckGray: [20, 110],
    speckSize: [0.8, 2.4],
  });
  // dark flecks over the lines
  const flecks = paperCanvas(w, h, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 700),
    speckAlpha: [70, 200],
    speckGray: [10, 70],
    speckSize: [0.8, 2],
  });
  return { band, flecks };
}

function draw(p, S, [vx, phi]) {
  const vy = BAND_Y; // the vanishing point is level with the top of the horizon strip
  const ctx = p.drawingContext;
  const [x0, y0, w, h] = WIN;
  const f = phi - Math.floor(phi);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();

  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineWidth = LINE_W;
  ctx.beginPath();
  for (let j = FIRST; j <= LAST_DRAWN; j++) {
    const yRef = vy - offset(j + f);
    const slope = (vy - yRef) / (vx - X_REF);
    ctx.moveTo(x0, vy - slope * (vx - x0));
    ctx.lineTo(x0 + w, vy - slope * (vx - x0 - w));
  }
  ctx.stroke();
  ctx.drawImage(S.tex.flecks, x0, y0);
  const bh = y0 + h - vy;
  ctx.drawImage(S.tex.band, 0, S.tex.band.height - bh, w, bh, x0, vy, w, bh);
  ctx.restore();
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: WIN,
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.tex = textures();
    S.pose = pose({
      rest: [VX, 0], // [vanishing point x, lines slid past]
      hold: HOLD,
      away: AWAY,
      settle: SETTLE,
      // one excursion: the lines flow on while the vanishing point sweeps
      ambient(c, v) {
        const e = Math.sin(Math.PI * c.u);
        v[0] = VX + SWEEP_X * Math.sin(2 * Math.PI * c.u) * e;
        v[1] = FLOW * smooth(c.u);
      },
      // the cursor steers the vanishing point and sets how fast the lines flow
      live(S, v, dt) {
        const k = Math.min(1, FOLLOW * dt);
        v[0] += (clamp(VX + (S.mouseX - (WIN[0] + WIN[2] / 2)) * PULL_X, VX - 1000, VX + 1000) - v[0]) * k;
        const up = clamp((BAND_Y - S.mouseY) / (BAND_Y - WIN[1]), 0, 1);
        v[1] += (FLOW_MIN + (FLOW_MAX - FLOW_MIN) * up) * dt;
      },
      restFor: (v) => [VX, Math.ceil(v[1])],
    });
  },
  frame(p, S) {
    const { pose: v, still, left } = S.pose.step(S);
    draw(p, S, v);
    if (still) S.sleep(left);
  },
});
