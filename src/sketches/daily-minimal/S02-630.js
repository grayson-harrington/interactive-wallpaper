// S02-630 horizon
// A square frame holding a moon over a horizon of lines that bunch up toward
// it. After a 15s rest, over 40s the lines flow toward the horizon (new ones
// slide in from the bottom of the frame) while the moon leaves along a wide
// arc up out of the top of the frame, and comes back up the same arc from
// below the horizon on the right, through its spot, to rest. The moon is only
// ever seen inside the frame. With someone at the page the moon follows the
// cursor sideways along that arc, dipping behind the horizon on the right and
// rising out of the frame on the left; when they leave it eases back to its
// spot and the lines settle onto the original.
import { dmSketch } from './harness.js';
import { paperCanvas } from '../../lib/paper.js';
import { pose } from './pose.js';

const bg = 22;
const ink = 240;

// Geometry, measured.
const FRAME = [397, 374, 646, 646]; // outer bounds
const FRAME_W = 3;
const HORIZON = 625.6; // where the lines converge (fitted)
const CLIP_Y = 636.5; // the moon is hidden below this
// y of the horizon lines, top to bottom; the last is the frame's bottom edge
const LINES = [637.5, 641, 644.5, 648, 651.5, 656, 664, 676.5, 691.5, 707.5, 728.5, 756.5, 788.5, 828, 878, 939.5, 1017.5];
const LINE_W = 1.5;
const RATIO = 1.25; // the lines keep bunching / spreading by this beyond the measured ones
const MOON = { x: 906, y: 539, r: 43.75 };

// The moon's arc: a circle through the horizon at the right, the moon's spot
// and a point above the frame's top-left.
const ARC = [
  [985, HORIZON],
  [MOON.x, MOON.y],
  [420, 250],
];

// Timing, in seconds.
const HOLD = 15;
const AWAY = 40;
const LEAVE = [0, 0.22]; // shares of AWAY: the moon goes up and away,
const GONE = 0.34; // stays out of sight until here,
const ENTER = [0.34, 0.57]; // and rises back to its spot
const FLOW = 6; // lines that slide past in one excursion
const LIVE_FLOW = 0.15; // lines per second while someone is at the page
const FOLLOW = 2.5; // per second

const TAU = Math.PI * 2;
const smooth = (t) => t * t * (3 - 2 * t);
const sub = (u, [a, b]) => smooth(Math.min(1, Math.max(0, (u - a) / (b - a))));

// Circle through three points, and the moon's place on it by arc angle u
// (0 at its spot, growing toward the top-left).
const arc = (() => {
  const [a, b, c] = ARC;
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  const sq = (v) => v[0] * v[0] + v[1] * v[1];
  const cx = (sq(a) * (b[1] - c[1]) + sq(b) * (c[1] - a[1]) + sq(c) * (a[1] - b[1])) / d;
  const cy = (sq(a) * (c[0] - b[0]) + sq(b) * (a[0] - c[0]) + sq(c) * (b[0] - a[0])) / d;
  const rho = Math.hypot(a[0] - cx, a[1] - cy);
  const th = (v) => Math.atan2(v[1] - cy, v[0] - cx);
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  const dir = Math.sign(wrap(th(b) - th(a)));
  const at = (u) => {
    const t = th(b) + dir * u;
    return [cx + rho * Math.cos(t), cy + rho * Math.sin(t)];
  };
  // the ends: clear of the frame's top, and below the horizon
  let uOut = 0;
  while (at(uOut)[1] > FRAME[1] - MOON.r - 12) uOut += 0.005;
  let uBelow = 0;
  while (at(uBelow)[1] < CLIP_Y + MOON.r + 12) uBelow -= 0.005;
  // x is monotonic along the arc, so the cursor's x picks a place on it
  const xs = [];
  const N = 400;
  for (let i = 0; i <= N; i++) xs.push(at(uBelow + ((uOut - uBelow) * i) / N)[0]);
  const forX = (x) => {
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] > x) lo = mid;
      else hi = mid;
    }
    const f = xs[lo] === xs[hi] ? 0 : (xs[lo] - x) / (xs[lo] - xs[hi]);
    return uBelow + ((uOut - uBelow) * (lo + Math.min(1, Math.max(0, f)))) / N;
  };
  return { at, uOut, uBelow, forX };
})();

// Distance of the lines below the horizon, by fractional line number u:
// measured ones in between, spread by RATIO beyond either end.
const OFF = LINES.map((y) => y - HORIZON);
const LAST = OFF.length - 1;
function lineY(u) {
  if (u <= 0) return HORIZON + OFF[0] * RATIO ** u;
  if (u >= LAST) return HORIZON + OFF[LAST] * RATIO ** (u - LAST);
  const j = Math.floor(u);
  const f = u - j;
  return HORIZON + OFF[j] ** (1 - f) * OFF[j + 1] ** f;
}

function paperSun() {
  const d = Math.ceil(MOON.r * 2) + 4;
  return paperCanvas(d, d, {
    base: 232,
    grainAlpha: [8, 16],
    specks: Math.round((d * d) / 60),
    speckAlpha: [60, 190],
    speckGray: [20, 120],
    speckSize: [0.8, 2],
  });
}

function draw(p, S, [u, phi]) {
  const ctx = p.drawingContext;
  const [x0, y0, w, h] = FRAME;
  const f = phi - Math.floor(phi);

  // horizon lines, sliding toward the horizon; the one that reaches it fades
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineWidth = LINE_W;
  ctx.beginPath();
  for (let j = 0; j <= LINES.length + 1; j++) {
    const n = j - f;
    const y = lineY(n);
    if (n < -1 || y > y0 + h - FRAME_W) continue;
    ctx.globalAlpha = n < 0 ? 1 + n : 1;
    ctx.beginPath();
    ctx.moveTo(x0 + FRAME_W, y);
    ctx.lineTo(x0 + w - FRAME_W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // frame
  ctx.lineWidth = FRAME_W;
  ctx.strokeRect(x0 + FRAME_W / 2, y0 + FRAME_W / 2, w - FRAME_W, h - FRAME_W);

  // moon, seen only inside the frame and above the horizon
  const [mx, my] = arc.at(u);
  if (my - MOON.r < CLIP_Y && my + MOON.r > y0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + FRAME_W, y0 + FRAME_W, w - 2 * FRAME_W, CLIP_Y - y0 - FRAME_W);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(mx, my, MOON.r, 0, TAU);
    ctx.clip();
    const d = S.sun.width;
    ctx.drawImage(S.sun, mx - d / 2, my - d / 2);
    ctx.restore();
  }
}

export default dmSketch({
  ow: 1440,
  oh: 1440,
  art: FRAME,
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.sun = paperSun();
    S.pose = pose({
      rest: [0, 0], // [moon's place on its arc, lines slid past]
      hold: HOLD,
      away: AWAY,
      settle: 6,
      // one excursion: the moon leaves, is gone a while, then rises back
      // while the lines flow on
      ambient(c, v) {
        const t = c.u;
        if (t < GONE) v[0] = arc.uOut * sub(t, LEAVE);
        else v[0] = arc.uBelow * (1 - sub(t, ENTER));
        v[1] = FLOW * smooth(c.u);
      },
      // the moon follows the cursor along its arc, the lines drift on
      live(S, v, dt) {
        v[0] += (arc.forX(S.mouseX) - v[0]) * Math.min(1, FOLLOW * dt);
        v[1] += LIVE_FLOW * dt;
      },
      restFor: (v) => [0, Math.ceil(v[1])],
    });
  },
  frame(p, S) {
    const { pose: v, still, left } = S.pose.step(S);
    draw(p, S, v);
    if (still) S.sleep(left);
  },
});
