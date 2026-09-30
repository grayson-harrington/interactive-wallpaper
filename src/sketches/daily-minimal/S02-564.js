// S02-564 ringed globe
// A wireframe globe in a thick ring, with a compass crosshair behind it and
// two tilted orbits carrying dots and rings. After a 15s rest the globe turns
// once and the bodies make one lap of their orbits over 36s (the dashed
// circles turning with them), landing back on the original. With someone at
// the page, the globe spins faster the further the cursor is to the right of
// center (and backwards on the left), the orbits speed up and slow down with
// it, and everything coasts back to rest when they leave.
import { dmSketch, restCycle, coastTo } from './harness.js';

const bg = 22;
const ink = 240;

// Geometry, measured (fitted to the original).
const CX = 497;
const CY = 478.6;
const RING_R = 108;
const RING_W = 5;

// Orbits: center, semi-axes, and the angle of the long axis.
const ORBIT_A = { x: 496.6, y: 479.8, a: 278.7, b: 79, rot: (-28.3 * Math.PI) / 180 };
const ORBIT_B = { x: 496.6, y: 477.7, a: 173.2, b: 93.4, rot: (33.2 * Math.PI) / 180 };

// Bodies as pixel positions on an orbit; the phase is recovered at init.
// kind: dot | ring. m is how many laps the body makes per lap of the cycle.
const BODIES = [
  { orbit: ORBIT_A, x: 675, y: 333.5, kind: 'dot', r: 9, m: 1 },
  { orbit: ORBIT_A, x: 391, y: 611, kind: 'ring', r: 14, w: 4, m: 1 },
  { orbit: ORBIT_B, x: 350, y: 446, kind: 'dot', r: 5.5, m: -1 },
  { orbit: ORBIT_B, x: 648, y: 522, kind: 'dot', r: 5.5, m: -1 },
];

// Dashed circles, turning against each other.
const DASH_R = 118.5;
const DASH_STEP = (10 * Math.PI) / 180; // 36 dashes, half on and half off
const DASH_OFF = (5 * Math.PI) / 180;
const ARC_R = 133.5;
// long arcs at r=133.5, degrees; the small rings sit on the ends
const ARCS = [
  [18, 42],
  [58, 83],
  [107, 146],
  [166, 186],
  [206, 238],
  [257, 314],
  [328, 346],
  [350, 378],
];
const ARC_RINGS = [43.5, 84.2, 147.5, 239.3, 314.6];

// Globe.
const G = { x: 496, y: 479, r: 61 };
const AXIS = [-0.43, 0.74, 0.517]; // toward the pole showing, z toward the viewer
const LON0 = (12 * Math.PI) / 180; // rest longitude of the meridian grid
const MERIDIANS = 16;
const LAT_STEP = 11;
const LAT_FIRST = -87;
const STEP_ANGLE = (Math.PI * 2) / MERIDIANS;

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;
const HOME = 6; // coasting to rest after someone leaves
const LAPS = 1;

// Live motion, radians per second.
const ORB_BASE = 0.12;
const GLOBE_BASE = 0.25;
const LEAN = 0.01; // globe radians per second per px of cursor offset
const FOLLOW = 2.5; // per second, velocities toward their target

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Orthonormal basis of the globe: u1, u2 perpendicular to the axis.
const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((c) => c / l);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const U1 = norm([1 - AXIS[0] * AXIS[0], -AXIS[0] * AXIS[1], -AXIS[0] * AXIS[2]]);
const U2 = cross(AXIS, U1);

// Point on the globe at latitude phi (toward the pole) and longitude lam.
function globePoint(phi, lam, out) {
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const cl = Math.cos(lam);
  const sl = Math.sin(lam);
  out[0] = G.x + G.r * (c * (cl * U1[0] + sl * U2[0]) + s * AXIS[0]);
  out[1] = G.y + G.r * (c * (cl * U1[1] + sl * U2[1]) + s * AXIS[1]);
  out[2] = c * (cl * U1[2] + sl * U2[2]) + s * AXIS[2];
}

const pt = [0, 0, 0];

// Strokes the visible (front) parts of a curve sampled by f(t) -> globePoint.
function strokeFront(ctx, n, f) {
  let pen = false;
  for (let i = 0; i <= n; i++) {
    f(i / n);
    if (pt[2] > 0) {
      if (pen) ctx.lineTo(pt[0], pt[1]);
      else ctx.moveTo(pt[0], pt[1]);
      pen = true;
    } else pen = false;
  }
}

function latitudePath() {
  const path = new Path2D();
  const c = { moveTo: (x, y) => path.moveTo(x, y), lineTo: (x, y) => path.lineTo(x, y) };
  for (let deg = LAT_FIRST; deg < 90; deg += LAT_STEP) {
    strokeFront(c, 90, (t) => globePoint((deg * Math.PI) / 180, t * TAU, pt));
  }
  return path;
}

function orbitPoint(o, t) {
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  const x = o.a * Math.cos(t);
  const y = o.b * Math.sin(t);
  return [o.x + x * c - y * s, o.y + x * s + y * c];
}

// Phase of the point (x, y) on an orbit.
function orbitPhase(o, x, y) {
  const dx = x - o.x;
  const dy = y - o.y;
  const c = Math.cos(o.rot);
  const s = Math.sin(o.rot);
  return Math.atan2((-dx * s + dy * c) / o.b, (dx * c + dy * s) / o.a);
}

function ellipsePath(ctx, o, from, to) {
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, o.a, o.b, o.rot, from, to);
  ctx.stroke();
}

function draw(p, S, orb, spin) {
  const ctx = p.drawingContext;
  const rad = (d) => (d * Math.PI) / 180;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.fillStyle = `rgb(${ink},${ink},${ink})`;

  // everything drawn "behind the ring" is kept out of its disc
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, S.ow, S.oh);
  ctx.arc(CX, CY, RING_R, 0, TAU, true);
  ctx.clip('evenodd');

  // crosshair
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(CX, 216);
  ctx.lineTo(CX, 752);
  ctx.moveTo(208, CY);
  ctx.lineTo(763.5, CY);
  ctx.moveTo(772.5, CY);
  ctx.lineTo(787, CY);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(CX - 6, 216);
  ctx.lineTo(CX, 204);
  ctx.lineTo(CX + 6, 216);
  ctx.closePath();
  ctx.moveTo(CX - 7, 216);
  ctx.lineTo(CX + 7, 216);
  ctx.moveTo(772.5, CY - 7);
  ctx.lineTo(772.5, CY + 7);
  ctx.moveTo(774, CY - 6);
  ctx.lineTo(787, CY);
  ctx.lineTo(774, CY + 6);
  ctx.closePath();
  ctx.stroke();
  for (const [x, y] of [[CX, 225], [CX, 727], [238, CY], [763.5, CY]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, TAU);
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  for (const [x, y] of [[CX, 266], [707.5, CY]]) {
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, TAU);
    ctx.fill();
  }

  // far half of the big orbit is hidden behind the ring
  ctx.lineWidth = 3.5;
  ellipsePath(ctx, ORBIT_A, Math.PI, TAU);
  ctx.restore();

  // dashed circles
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let i = 0; i < 36; i++) {
    const a = DASH_OFF + i * DASH_STEP + orb;
    ctx.moveTo(CX + DASH_R * Math.cos(a), CY + DASH_R * Math.sin(a));
    ctx.arc(CX, CY, DASH_R, a, a + DASH_STEP / 2);
  }
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (const [a0, a1] of ARCS) {
    ctx.moveTo(CX + ARC_R * Math.cos(rad(a0) - orb), CY + ARC_R * Math.sin(rad(a0) - orb));
    ctx.arc(CX, CY, ARC_R, rad(a0) - orb, rad(a1) - orb);
  }
  ctx.stroke();
  for (const a of ARC_RINGS) {
    ctx.beginPath();
    ctx.arc(CX + ARC_R * Math.cos(rad(a) - orb), CY + ARC_R * Math.sin(rad(a) - orb), 4, 0, TAU);
    ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = `rgb(${ink},${ink},${ink})`;

  // orbits: the second in full, the near half of the first
  ctx.lineWidth = 1.5;
  ellipsePath(ctx, ORBIT_B, 0, TAU);
  ctx.lineWidth = 3.5;
  ellipsePath(ctx, ORBIT_A, 0, Math.PI);

  // bodies
  for (const b of BODIES) {
    const t = b.t0 + b.m * orb;
    const [x, y] = orbitPoint(b.orbit, t);
    if (b.orbit === ORBIT_A && Math.sin(t) < 0 && Math.hypot(x - CX, y - CY) < RING_R + b.r) continue;
    ctx.beginPath();
    ctx.arc(x, y, b.r, 0, TAU);
    if (b.kind === 'dot') ctx.fill();
    else {
      ctx.lineWidth = b.w;
      ctx.stroke();
    }
  }

  // ring
  ctx.lineWidth = RING_W;
  ctx.beginPath();
  ctx.arc(CX, CY, RING_R, 0, TAU);
  ctx.stroke();

  // globe: latitudes are fixed, meridians turn with the spin
  ctx.lineWidth = 0.9;
  ctx.stroke(S.lat);
  ctx.beginPath();
  const lon = LON0 + spin;
  for (let m = 0; m < MERIDIANS; m++) {
    const lam = lon + m * STEP_ANGLE;
    strokeFront(ctx, 48, (t) => globePoint(-Math.PI / 2 + t * Math.PI, lam, pt));
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(G.x, G.y, G.r, 0, TAU);
  ctx.stroke();
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: [208, 202, 580, 551],
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    for (const b of BODIES) b.t0 = orbitPhase(b.orbit, b.x, b.y);
    S.lat = latitudePath();
    S.cyc = restCycle({ hold: HOLD, away: AWAY });
    S.mode = 'cycle'; // cycle | live | home
    S.orb = 0;
    S.spin = 0;
    S.orbW = 0;
    S.spinW = 0;
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(S.dt, 0.1);
    const c = S.cyc;

    if (S.live && S.mode !== 'live') {
      // take over from wherever the cycle is, keeping its speed
      if (S.mode === 'cycle' && c.phase === 'away') {
        const w = (TAU * LAPS * 6 * c.u * (1 - c.u)) / AWAY;
        S.orbW = w;
        S.spinW = w;
      } else if (S.mode === 'cycle') {
        S.orbW = S.spinW = 0;
      }
      S.mode = 'live';
    } else if (!S.live && S.mode === 'live') {
      S.mode = 'home';
      S.homeU = 0;
      S.orbTo = coastTo(S.orb, S.orbW, 0, HOME);
      S.spinTo = coastTo(S.spin, S.spinW, 0, HOME);
    }

    if (S.mode === 'live') {
      const k = Math.min(1, FOLLOW * dt);
      const lean = clamp((S.mouseX - CX) * LEAN, -3, 3);
      S.spinW += (GLOBE_BASE + lean - S.spinW) * k;
      S.orbW += (ORB_BASE + lean * 0.4 - S.orbW) * k;
      S.spin += S.spinW * dt;
      S.orb += S.orbW * dt;
    } else if (S.mode === 'home') {
      S.homeU = Math.min(1, S.homeU + dt / HOME);
      S.orb = S.orbTo(S.homeU);
      S.spin = S.spinTo(S.homeU);
      if (S.homeU >= 1) {
        S.orb = S.spin = 0;
        S.mode = 'cycle';
        S.cyc = restCycle({ hold: HOLD, away: AWAY });
      }
    } else {
      c.step(S.dt);
      const a = c.phase === 'away' ? TAU * LAPS * c.k : 0;
      S.orb = S.spin = a;
    }

    draw(p, S, S.orb, S.spin);

    if (S.mode === 'cycle' && S.cyc.phase === 'hold') S.sleep(S.cyc.left);
  },
});
