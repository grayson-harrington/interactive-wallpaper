// S02-433 linked circles
// A 4x4 grid of paper circles, some joined into capsules and S-curves by
// bridges that keep a 6px gap from every neighbor. The links re-route on
// their own, like metaballs: every few seconds one bridge thins to a waist
// and snaps apart while another pair of neighbors reaches out and fuses,
// then after a while the grid works its way back to the original layout and
// rests there. With someone at the
// page, sweeping the cursor from one circle to a neighbor links them; those
// links melt away again after a few seconds.
import { dmSketch } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 22;

// Geometry, measured: circles 128px across on a 134px pitch, the first
// centered at (439, 426).
const N = 4;
const PITCH = 134;
const R = 64;
const X0 = 439;
const Y0 = 426;
const SPAN = (N - 1) * PITCH + 2 * R;
const ART = [X0 - R, Y0 - R, SPAN, SPAN];

// A link's bridge is a metaball blend: the smooth union of its two circles'
// distance fields, smin(dA, dB, k) < 0 (polynomial smooth-min). The blend
// radius k is the link's strength. As it grows each circle bulges toward the
// other with a rounded front, they fuse, and the neck fattens. The blend is
// clipped to the original's bridge, so a full-strength link is exactly the
// original: the band between its circles, and for a diagonal link also the
// square between its 2x2 block's centers, less 70px discs around the block's
// other two circles (the 6px gap). K = [bulging starts, the fronts
// touch, the bridge is full], found numerically for this geometry.
const K_STRAIGHT = [6, 12, 120];
const K_DIAG = [60, 124, 145];
// While a diagonal link grows, its cuts (the square and the discs) are soft
// too, rounded by up to CUT_SOFT px, hardening to the original's as it ends.
const CUT_SOFT = 16;

// The original's links, as [[i, j], [i, j]] cells.
const ORIGINAL = [
  [[0, 0], [0, 1]],
  [[2, 0], [3, 0]],
  [[1, 1], [2, 0]],
  [[2, 1], [3, 2]],
  [[0, 2], [1, 3]],
  [[1, 3], [2, 2]],
];

// Timing, in seconds.
const GROW = 2.5; // a bridge melting or growing
const REST = 20; // holding the original
const PAUSE = 3; // between re-routes
const WANDER = 12; // re-routes before heading home
const USER_LIFE = 6; // a link drawn with the cursor
const MAX_DEGREE = 2;

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const cellId = (i, j) => j * N + i;
const cellOf = (c) => [c % N, Math.floor(c / N)];
const center = (c) => [X0 + (c % N) * PITCH, Y0 + Math.floor(c / N) * PITCH];

function linkKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function makeLink(a, b) {
  const [ai, aj] = cellOf(a);
  const [bi, bj] = cellOf(b);
  const diag = ai !== bi && aj !== bj;
  return { key: linkKey(a, b), a, b, diag, block: [Math.min(ai, bi), Math.min(aj, bj)], s: 0, target: 1, born: 0, user: false };
}

// Every pair of 8-way neighbors.
const ALL = [];
for (let c = 0; c < N * N; c++) {
  const [i, j] = cellOf(c);
  for (const [di, dj] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    const ni = i + di;
    const nj = j + dj;
    if (ni >= 0 && ni < N && nj < N) ALL.push([c, cellId(ni, nj)]);
  }
}
const ORIGINAL_KEYS = new Set(ORIGINAL.map(([[ai, aj], [bi, bj]]) => linkKey(cellId(ai, aj), cellId(bi, bj))));

const inBlock = (c, [bi, bj]) => {
  const [i, j] = cellOf(c);
  return i >= bi && i <= bi + 1 && j >= bj && j <= bj + 1;
};

// Two links that can't coexist: crossing diagonals, a diagonal and any
// straight link inside its block (they'd merge into a blob), or two straight
// links sharing a circle (no runs or corners of three).
const shares = (l, m) => l.a === m.a || l.a === m.b || l.b === m.a || l.b === m.b;

function conflicts(l, m) {
  if (l.key === m.key) return true;
  if (!l.diag && !m.diag) return shares(l, m);
  const [d, o] = l.diag ? [l, m] : [m, l];
  const sameBlock = d.block[0] === o.block[0] && d.block[1] === o.block[1];
  if (o.diag) return sameBlock;
  return inBlock(o.a, d.block) && inBlock(o.b, d.block);
}

function paperTexture() {
  const [, , w, h] = ART;
  const tex = dotPaperCanvas(w + 4, h + 4, { base: 240, gray: [185, 255], alpha: [60, 140], density: 1 });
  const flecks = paperCanvas(w + 4, h + 4, {
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

function clipOutsideDisc(ctx, x, y, r) {
  ctx.beginPath();
  ctx.rect(ART[0] - 200, ART[1] - 200, ART[2] + 400, ART[3] + 400);
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip('evenodd');
}

const smin = (a, b, k) => {
  if (k < 1e-3) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// Blend radius for strength s: the first half of the growth bulges the
// circles until they touch, the second fills out the neck.
function blendAt(l) {
  const [k0, k1, k2] = l.diag ? K_DIAG : K_STRAIGHT;
  const e = smoother(l.s);
  return e < 0.5 ? k0 + (k1 - k0) * (e / 0.5) : k1 + (k2 - k1) * ((e - 0.5) / 0.5);
}

// Add the region smin(dA, dB, k) < 0 inside box [x0, y0, w, h] to the current
// path, by marching squares on a 1px grid: runs of inside cells as rects,
// edge cells as clipped polygons, all wound the same way so one nonzero fill
// or clip covers them without seams.
const field = new Float32Array(400 * 400);

function blendPath(ctx, l, x0, y0, w, h) {
  const [ax, ay] = center(l.a);
  const [bx, by] = center(l.b);
  const k = blendAt(l);
  // a diagonal's cuts: the block square, and 70px discs around its other
  // two circles at (ax, by) and (bx, ay)
  const soft = CUT_SOFT * (1 - smoother(l.s));
  const sx = (ax + bx) / 2;
  const sy = (ay + by) / 2;
  const half = PITCH / 2;
  const nx = Math.ceil(w) + 1;
  const ny = Math.ceil(h) + 1;
  for (let j = 0; j < ny; j++) {
    const y = y0 + j;
    for (let i = 0; i < nx; i++) {
      const x = x0 + i;
      let v = smin(Math.hypot(x - ax, y - ay) - R, Math.hypot(x - bx, y - by) - R, k);
      if (l.diag) {
        v = smax(v, PITCH - R - Math.hypot(x - ax, y - by), soft);
        v = smax(v, PITCH - R - Math.hypot(x - bx, y - ay), soft);
        const qx = Math.abs(x - sx) - half;
        const qy = Math.abs(y - sy) - half;
        const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0);
        v = smax(v, box, soft);
      }
      field[j * nx + i] = v;
    }
  }
  const cx = [0, 1, 1, 0];
  const cy = [0, 0, 1, 1];
  const v = [0, 0, 0, 0];
  for (let j = 0; j < ny - 1; j++) {
    let run = -1;
    for (let i = 0; i < nx - 1; i++) {
      v[0] = field[j * nx + i];
      v[1] = field[j * nx + i + 1];
      v[2] = field[(j + 1) * nx + i + 1];
      v[3] = field[(j + 1) * nx + i];
      const all = v[0] < 0 && v[1] < 0 && v[2] < 0 && v[3] < 0;
      if (all) {
        if (run < 0) run = i;
        continue;
      }
      if (run >= 0) {
        ctx.rect(x0 + run, y0 + j, i - run, 1);
        run = -1;
      }
      if (!(v[0] < 0 || v[1] < 0 || v[2] < 0 || v[3] < 0)) continue;
      let first = true;
      for (let c = 0; c < 4; c++) {
        const n = (c + 1) & 3;
        if (v[c] < 0) {
          const px = x0 + i + cx[c];
          const py = y0 + j + cy[c];
          if (first) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
          first = false;
        }
        if (v[c] < 0 !== v[n] < 0) {
          const t = v[c] / (v[c] - v[n]);
          const px = x0 + i + cx[c] + (cx[n] - cx[c]) * t;
          const py = y0 + j + cy[c] + (cy[n] - cy[c]) * t;
          if (first) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
          first = false;
        }
      }
      ctx.closePath();
    }
    if (run >= 0) ctx.rect(x0 + run, y0 + j, nx - 1 - run, 1);
  }
}

function drawBridge(ctx, tex, l) {
  const [ax, ay] = center(l.a);
  const [bx, by] = center(l.b);
  // the band between the two circles, and its bounding box
  const d = Math.hypot(bx - ax, by - ay);
  const nx = (-(by - ay) / d) * R;
  const ny = ((bx - ax) / d) * R;
  const x0 = Math.floor(Math.min(ax, bx) - Math.abs(nx));
  const y0 = Math.floor(Math.min(ay, by) - Math.abs(ny));
  const w = Math.ceil(Math.max(ax, bx) + Math.abs(nx)) - x0;
  const h = Math.ceil(Math.max(ay, by) + Math.abs(ny)) - y0;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ax + nx, ay + ny);
  ctx.lineTo(bx + nx, by + ny);
  ctx.lineTo(bx - nx, by - ny);
  ctx.lineTo(ax - nx, ay - ny);
  ctx.closePath();
  ctx.clip();
  if (l.s < 1) {
    ctx.beginPath();
    blendPath(ctx, l, x0, y0, w, h);
    ctx.clip();
  } else if (l.diag) {
    // at rest, exactly the original: within the square between the block's
    // four centers, 6px clear of the block's other two circles
    ctx.beginPath();
    ctx.rect(Math.min(ax, bx), Math.min(ay, by), PITCH, PITCH);
    ctx.clip();
    clipOutsideDisc(ctx, ax, by, PITCH - R);
    clipOutsideDisc(ctx, bx, ay, PITCH - R);
  }
  ctx.drawImage(tex, x0 - (ART[0] - 2), y0 - (ART[1] - 2), w, h, x0, y0, w, h);
  ctx.restore();
}

function draw(p, S) {
  const ctx = p.drawingContext;
  ctx.save();
  ctx.beginPath();
  for (let c = 0; c < N * N; c++) {
    const [x, y] = center(c);
    ctx.moveTo(x + R, y);
    ctx.arc(x, y, R, 0, Math.PI * 2);
  }
  ctx.clip();
  ctx.drawImage(S.tex, ART[0] - 2, ART[1] - 2);
  ctx.restore();
  for (const l of S.links.values()) if (l.s > 0) drawBridge(ctx, S.tex, l);
}

// Links that are there or on their way in.
function standing(S) {
  return [...S.links.values()].filter((l) => l.target === 1);
}

function degree(S, c) {
  return standing(S).filter((l) => l.a === c || l.b === c).length;
}

function add(S, a, b, user = false) {
  const key = linkKey(a, b);
  const l = S.links.get(key) ?? makeLink(a, b);
  l.target = 1;
  l.user = user;
  l.born = S.now;
  S.links.set(key, l);
}

const remove = (l) => {
  l.target = 0;
};

// One ambient move: a random re-route, or a step back toward the original.
function step(S) {
  const live = standing(S);
  if (S.state === 'rest') {
    S.state = 'wander';
    S.count = 0;
  }
  if (S.state === 'wander') {
    const out = live[Math.floor(Math.random() * live.length)];
    const rest = live.filter((l) => l !== out);
    const deg = (c) => rest.filter((l) => l.a === c || l.b === c).length;
    const options = ALL.map(([a, b]) => makeLink(a, b)).filter(
      (m) => m.key !== out?.key && !rest.some((l) => conflicts(l, m)) && deg(m.a) < MAX_DEGREE && deg(m.b) < MAX_DEGREE,
    );
    if (out) remove(out);
    const pick = options[Math.floor(Math.random() * options.length)];
    if (pick) add(S, pick.a, pick.b);
    if (++S.count >= WANDER) S.state = 'return';
    return;
  }
  // return: restore one missing original link at a time
  const extra = live.filter((l) => !ORIGINAL_KEYS.has(l.key));
  const missing = ORIGINAL.map(([[ai, aj], [bi, bj]]) => makeLink(cellId(ai, aj), cellId(bi, bj))).filter(
    (m) => !live.some((l) => l.key === m.key),
  );
  if (!missing.length) {
    if (extra.length) remove(extra[0]);
    else S.state = 'rest';
    return;
  }
  const m = missing[0];
  const blocking = extra.filter((l) => conflicts(l, m));
  if (blocking.length) {
    remove(blocking[0]);
    return;
  }
  if (extra.length) remove(extra[Math.floor(Math.random() * extra.length)]);
  add(S, m.a, m.b);
}

// One pending wake-up at a time; disarming makes a pending one a no-op.
function arm(p, S, seconds, fn) {
  const token = ++S.token;
  S.armed = true;
  p.schedule(() => {
    if (token !== S.token) return;
    S.armed = false;
    fn();
    p.loop();
  }, seconds * 1000);
}

function disarm(S) {
  S.token++;
  S.armed = false;
}

// The cell whose circle is under (x, y), or -1.
function cellAt(x, y) {
  const i = Math.round((x - X0) / PITCH);
  const j = Math.round((y - Y0) / PITCH);
  if (i < 0 || j < 0 || i >= N || j >= N) return -1;
  const c = cellId(i, j);
  const [cx, cy] = center(c);
  return Math.hypot(x - cx, y - cy) <= R ? c : -1;
}

// Sweeping from one circle into a neighbor links them; the new link wins
// over anything it conflicts with, and a busy circle drops its oldest link.
function hover(S) {
  const c = cellAt(S.mouseX, S.mouseY);
  if (c < 0 || c === S.lastCell) return;
  const prev = S.lastCell;
  S.lastCell = c;
  if (prev < 0) return;
  const [pi, pj] = cellOf(prev);
  const [ci, cj] = cellOf(c);
  if (Math.abs(pi - ci) > 1 || Math.abs(pj - cj) > 1) return;
  const m = makeLink(prev, c);
  for (const l of standing(S)) if (l.key !== m.key && conflicts(l, m)) remove(l);
  for (const cell of [prev, c]) {
    const own = standing(S)
      .filter((l) => l.key !== m.key && (l.a === cell || l.b === cell))
      .sort((x, y) => x.born - y.born);
    while (own.length >= MAX_DEGREE) remove(own.shift());
  }
  add(S, prev, c, true);
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: ART, // the grid of circles
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.tex = paperTexture();
    S.now = 0;
    S.links = new Map();
    for (const [[ai, aj], [bi, bj]] of ORIGINAL) {
      add(S, cellId(ai, aj), cellId(bi, bj));
    }
    for (const l of S.links.values()) l.s = 1;
    S.state = 'rest';
    S.armed = false;
    S.token = 0;
    S.wasLive = false;
    S.lastCell = -1;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    S.now = p.millis() / 1000;
    if (S.live !== S.wasLive) disarm(S);

    if (S.live) {
      hover(S);
      for (const l of S.links.values()) if (l.user && l.target === 1 && S.now - l.born > USER_LIFE) remove(l);
    } else {
      S.lastCell = -1;
      // head home from whatever the cursor left behind
      if (S.wasLive) S.state = 'return';
    }
    S.wasLive = S.live;

    let moving = false;
    for (const [key, l] of S.links) {
      if (l.s === l.target) continue;
      l.s = l.target > l.s ? Math.min(1, l.s + dt / GROW) : Math.max(0, l.s - dt / GROW);
      if (l.s === 0 && l.target === 0) S.links.delete(key);
      moving = true;
    }

    draw(p, S);

    const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);
    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
    if (moving || mouseMoved) return;
    p.noLoop();
    if (S.armed) return;
    if (S.live) {
      // wake for user links expiring, and to notice input going quiet
      const expiring = [...S.links.values()].filter((l) => l.user && l.target === 1);
      const next = Math.min(5, ...expiring.map((l) => USER_LIFE - (S.now - l.born) + 0.05));
      arm(p, S, Math.max(0.05, next), () => {});
    } else {
      arm(p, S, S.state === 'rest' ? REST : PAUSE, () => step(S));
    }
  },
  onActivate(p, S) {
    disarm(S);
  },
});
