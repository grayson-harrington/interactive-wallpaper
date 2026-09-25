// S02-525 broken square
// A grainy dark square cut by straight lines, each cut splitting only the
// piece(s) it runs through, with every shard nudged and turned a little apart.
// The shards slide back into a sealed square, then break again one cut at a
// time: a hairline scores across a piece and its halves ease apart. Most
// breaks are freshly generated; every third replays the original's cuts and
// rests on the original. A click cuts the shard under the cursor at a random
// angle; after 20s without a cut it heals and breaks back into the original.
import { dmSketch } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 239;
const ink = 41;

// The sealed square the original was cut from (fitted, 408px).
const X0 = 296;
const Y0 = 281;
const SIDE = 408;
const SQUARE = [X0, Y0, X0 + SIDE, Y0, X0 + SIDE, Y0 + SIDE, X0, Y0 + SIDE];

// The original's shards in sealed-square coordinates, each with the rigid
// move (rotation a about the origin, then x/y) that puts it where the design
// has it. Fitted to the measured corners, within 2px.
const ORIGINAL = [
  {
    poly: [468.3, 281.0, 704.0, 281.0, 704.0, 383.9, 392.4, 339.8],
    a: -0.02626,
    x: 11.58,
    y: 3.57,
  },
  {
    poly: [296.0, 281.0, 468.3, 281.0, 296.0, 414.6],
    a: -0.02056,
    x: -26.72,
    y: 2.47,
  },
  {
    poly: [296.0, 414.6, 392.4, 339.8, 640.2, 374.9, 538.9, 568.2, 296.0, 441.8],
    a: -0.00269,
    x: -10.65,
    y: 0.91,
  },
  {
    poly: [640.2, 374.9, 704.0, 383.9, 704.0, 574.9, 516.2, 611.4],
    a: -0.0009,
    x: 12.45,
    y: 1.56,
  },
  {
    poly: [296.0, 441.8, 538.9, 568.2, 516.2, 611.4, 296.0, 654.2],
    a: 0.00132,
    x: -6.27,
    y: 6.57,
  },
  {
    poly: [516.2, 611.4, 704.0, 574.9, 704.0, 689.0, 475.5, 689.0],
    a: 0.00094,
    x: 13.68,
    y: 15.36,
  },
  {
    poly: [296.0, 654.2, 516.2, 611.4, 475.5, 689.0, 296.0, 689.0],
    a: -0.00245,
    x: -1.54,
    y: 12.32,
  },
];
// Its cuts in order, as the groups of shards that move together after each
// one, and the scored segments with a shard whose frame each is drawn in.
// The last cut runs through two pieces at once.
const ORIGINAL_STEPS = [
  {
    groups: [[1], [0, 2, 3, 4, 5, 6]],
    segs: [[468.3, 281.0, 296.0, 414.6, 1]],
  },
  {
    groups: [[1], [0], [2, 3, 4, 5, 6]],
    segs: [[392.4, 339.8, 704.0, 383.9, 0]],
  },
  {
    groups: [[1], [0], [2, 4, 6], [3, 5]],
    segs: [[640.2, 374.9, 475.5, 689.0, 2]],
  },
  {
    groups: [[1], [0], [2], [4, 6], [3, 5]],
    segs: [[296.0, 441.8, 538.9, 568.2, 2]],
  },
  {
    groups: [[0], [1], [2], [3], [4], [5], [6]],
    segs: [
      [296.0, 654.2, 516.2, 611.4, 4],
      [516.2, 611.4, 704.0, 574.9, 3],
    ],
  },
];

// Generated fractures.
const CUTS = 5;
const EXTEND = 0.35; // chance a cut carries on through the neighbouring piece
const MAX_CUTS = 20; // including clicked ones
const MAX_PIECES = 2 * MAX_CUTS + 1; // a cut adds at most two pieces
const GAP = [3, 36];
const TURN = 0.02; // radians, per cut
const SLIDE = 8;
const MARGIN = 1.5; // closest two shards may come

// Timing, in seconds.
const HOLD = 40;
const HOLD_ORIGINAL = 60;
const HEAL = 20;
const MEND = 4;
const SEALED = 3;
const SCORE = 0.45;
const SPLIT = 0.85;
const PAUSE = 0.15;
const LINE = 1.6;

const smooth = (t) => t * t * (3 - 2 * t);
const rand = (a, b) => a + Math.random() * (b - a);
const IDENTITY = { a: 0, x: 0, y: 0 };

// --- polygons (flat [x0, y0, x1, y1, ...], counter-clockwise on screen) ---

function area(poly) {
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i += 2) {
    const j = (i + 2) % n;
    s += poly[i] * poly[j + 1] - poly[j] * poly[i + 1];
  }
  return s / 2;
}

function centroid(poly) {
  let cx = 0;
  let cy = 0;
  let s = 0;
  for (let i = 0, n = poly.length; i < n; i += 2) {
    const j = (i + 2) % n;
    const c = poly[i] * poly[j + 1] - poly[j] * poly[i + 1];
    cx += (poly[i] + poly[j]) * c;
    cy += (poly[i + 1] + poly[j + 1]) * c;
    s += c;
  }
  return [cx / (3 * s), cy / (3 * s)];
}

function orient(poly) {
  if (area(poly) >= 0) return poly;
  const out = [];
  for (let i = poly.length - 2; i >= 0; i -= 2) out.push(poly[i], poly[i + 1]);
  return out;
}

function contains(poly, x, y) {
  for (let i = 0, n = poly.length; i < n; i += 2) {
    const j = (i + 2) % n;
    if ((poly[j] - poly[i]) * (y - poly[i + 1]) - (poly[j + 1] - poly[i + 1]) * (x - poly[i]) < 0) return false;
  }
  return true;
}

// Shape checks so no cut leaves a sliver: size, roundness, sharpest corner.
function shapely(poly, minArea, minRound, minAngle) {
  const A = area(poly);
  if (A < minArea) return false;
  let per = 0;
  const n = poly.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    const k = (i + n - 2) % n;
    per += Math.hypot(poly[j] - poly[i], poly[j + 1] - poly[i + 1]);
    const ax = poly[k] - poly[i];
    const ay = poly[k + 1] - poly[i + 1];
    const bx = poly[j] - poly[i];
    const by = poly[j + 1] - poly[i + 1];
    const cos = (ax * bx + ay * by) / Math.hypot(ax, ay) / Math.hypot(bx, by);
    if (Math.acos(Math.max(-1, Math.min(1, cos))) < minAngle) return false;
  }
  return (4 * Math.PI * A) / (per * per) >= minRound;
}

// Split a convex polygon by the line through (px, py) along (dx, dy).
// Returns [left, right, segment] or null if the line misses it.
function split(poly, px, py, dx, dy) {
  const L = [];
  const R = [];
  const seg = [];
  const n = poly.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    const si = dx * (poly[i + 1] - py) - dy * (poly[i] - px);
    const sj = dx * (poly[j + 1] - py) - dy * (poly[j] - px);
    if (si >= 0) L.push(poly[i], poly[i + 1]);
    if (si <= 0) R.push(poly[i], poly[i + 1]);
    if ((si > 0 && sj < 0) || (si < 0 && sj > 0)) {
      const t = si / (si - sj);
      const x = poly[i] + (poly[j] - poly[i]) * t;
      const y = poly[i + 1] + (poly[j + 1] - poly[i + 1]) * t;
      L.push(x, y);
      R.push(x, y);
      seg.push(x, y);
    }
  }
  if (seg.length < 4 || L.length < 6 || R.length < 6) return null;
  return [L, R, seg];
}

// --- rigid moves {a, x, y}: p -> rotate(a) p + (x, y) ---

function apply(T, x, y) {
  const c = Math.cos(T.a);
  const s = Math.sin(T.a);
  return [c * x - s * y + T.x, s * x + c * y + T.y];
}

function worldPoly(poly, T) {
  const out = new Array(poly.length);
  for (let i = 0; i < poly.length; i += 2) {
    const [x, y] = apply(T, poly[i], poly[i + 1]);
    out[i] = x;
    out[i + 1] = y;
  }
  return out;
}

// Turn by da about world point (qx, qy), then shift by (tx, ty), after T.
function nudge(T, da, qx, qy, tx, ty) {
  const c = Math.cos(da);
  const s = Math.sin(da);
  return {
    a: T.a + da,
    x: c * (T.x - qx) - s * (T.y - qy) + qx + tx,
    y: s * (T.x - qx) + c * (T.y - qy) + qy + ty,
  };
}

// True if two convex world polygons stay at least `gap` apart.
function apart(A, B, gap) {
  for (const [P, Q] of [
    [A, B],
    [B, A],
  ]) {
    for (let i = 0, n = P.length; i < n; i += 2) {
      const j = (i + 2) % n;
      const ex = P[j] - P[i];
      const ey = P[j + 1] - P[i + 1];
      const len = Math.hypot(ex, ey);
      let min = Infinity;
      for (let k = 0; k < Q.length; k += 2) {
        min = Math.min(min, (ey * (Q[k] - P[i]) - ex * (Q[k + 1] - P[i + 1])) / len);
      }
      if (min >= gap) return true;
    }
  }
  return false;
}

// --- arrangements ---
// { pieces: [{ poly, area, T: [move after each step] }],
//   steps: [{ segs: [{ x0, y0, x1, y1, T }] }], off: [[x, y] per step], hold }
// Step 0 is the sealed square; the last step is the resting fracture.

function center(arr, k) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const pc of arr.pieces) {
    const w = worldPoly(pc.poly, pc.T[k]);
    for (let i = 0; i < w.length; i += 2) {
      x0 = Math.min(x0, w[i]);
      x1 = Math.max(x1, w[i]);
      y0 = Math.min(y0, w[i + 1]);
      y1 = Math.max(y1, w[i + 1]);
    }
  }
  return [500 - (x0 + x1) / 2, 500 - (y0 + y1) / 2];
}

function withOffsets(arr) {
  arr.off = arr.pieces[0].T.map((_, k) => center(arr, k));
  return arr;
}

// The original, with each intermediate group placed at the best fit of its
// shards' final moves so a group moves as one rigid piece.
function originalArrangement() {
  const pieces = ORIGINAL.map((o) => ({
    poly: orient(o.poly),
    area: Math.abs(area(o.poly)),
    T: [IDENTITY],
    final: { a: o.a, x: o.x, y: o.y },
  }));
  const steps = [{ segs: [] }];
  ORIGINAL_STEPS.forEach((st, k) => {
    for (const g of st.groups) {
      let w = 0;
      let a = 0;
      let cx = 0;
      let cy = 0;
      let mx = 0;
      let my = 0;
      for (const i of g) {
        const pc = pieces[i];
        const [x, y] = centroid(pc.poly);
        const [u, v] = apply(pc.final, x, y);
        w += pc.area;
        a += pc.final.a * pc.area;
        cx += x * pc.area;
        cy += y * pc.area;
        mx += u * pc.area;
        my += v * pc.area;
      }
      a /= w;
      const [rx, ry] = apply({ a, x: 0, y: 0 }, cx / w, cy / w);
      const T = g.length === 1 ? pieces[g[0]].final : { a, x: mx / w - rx, y: my / w - ry };
      for (const i of g) pieces[i].T[k + 1] = T;
    }
    steps.push({
      segs: st.segs.map(([x0, y0, x1, y1, rep]) => ({
        x0,
        y0,
        x1,
        y1,
        T: pieces[rep].T[k],
      })),
    });
  });
  return withOffsets({ pieces, steps, hold: HOLD_ORIGINAL });
}

// Cut `targets` (pieces of arr) along one line and move the halves apart.
// Returns the new pieces and scored segments, or null if it doesn't fit.
function cutPieces(arr, targets, px, py, dx, dy, shape, gapRange) {
  const k = arr.pieces[0].T.length - 1;
  const halves = [];
  for (const pc of targets) {
    const r = split(pc.poly, px, py, dx, dy);
    if (!r || !shapely(r[0], ...shape) || !shapely(r[1], ...shape)) return null;
    halves.push(r);
  }
  const len = Math.hypot(dx, dy);
  const others = arr.pieces.filter((pc) => !targets.includes(pc)).map((pc) => worldPoly(pc.poly, pc.T[k]));
  const out = [];
  const segs = [];
  targets.forEach((pc, t) => {
    const [L, R, seg] = halves[t];
    const T = pc.T[k];
    segs.push({ x0: seg[0], y0: seg[1], x1: seg[2], y1: seg[3], T });
    out.push({
      parent: pc,
      L,
      R,
      T,
      nx: -dy / len,
      ny: dx / len,
      tx: dx / len,
      ty: dy / len,
    });
  });
  // try decreasing separations until nothing collides
  for (let attempt = 0; attempt < 30; attempt++) {
    const scale = 1 - attempt / 30;
    const placed = [];
    let ok = true;
    for (const h of out) {
      const g = (gapRange[0] + (gapRange[1] - gapRange[0]) * Math.random() ** 2 * scale) / 2;
      const share = rand(0.2, 0.8) * 2;
      const slide = rand(-SLIDE, SLIDE) * scale;
      const [nx, ny] = apply({ a: h.T.a, x: 0, y: 0 }, h.nx, h.ny);
      const [tx, ty] = apply({ a: h.T.a, x: 0, y: 0 }, h.tx, h.ty);
      for (const [poly, sign, amt] of [
        [h.L, 1, share],
        [h.R, -1, 2 - share],
      ]) {
        const [qx, qy] = apply(h.T, ...centroid(poly));
        const move = g * amt;
        const sl = sign > 0 ? slide : 0;
        const T = nudge(h.T, rand(-TURN, TURN) * scale, qx, qy, sign * nx * move + tx * sl, sign * ny * move + ty * sl);
        const w = worldPoly(poly, T);
        if (!others.every((o) => apart(o, w, MARGIN)) || !placed.every((o) => apart(o.w, w, MARGIN))) ok = false;
        placed.push({ poly, T, w, parent: h.parent });
      }
      if (!ok) break;
    }
    if (ok) return { placed, segs };
  }
  return null;
}

function applyCut(arr, cut) {
  const k = arr.pieces[0].T.length - 1;
  const next = [];
  for (const pc of arr.pieces) {
    const kids = cut.placed.filter((c) => c.parent === pc);
    if (!kids.length) {
      pc.T.push(pc.T[k]);
      next.push(pc);
    } else {
      for (const c of kids) {
        next.push({
          poly: c.poly,
          area: Math.abs(area(c.poly)),
          T: [...pc.T, c.T],
        });
      }
    }
  }
  arr.pieces = next;
  arr.steps.push({ segs: cut.segs });
}

function randomArrangement() {
  const arr = {
    pieces: [{ poly: SQUARE, area: SIDE * SIDE, T: [IDENTITY] }],
    steps: [{ segs: [] }],
    hold: HOLD,
  };
  const shape = [SIDE * SIDE * 0.03, 0.4, (20 * Math.PI) / 180];
  for (let c = 0; c < CUTS; c++) {
    for (let tries = 0; tries < 80; tries++) {
      // prefer big pieces
      const weights = arr.pieces.map((pc) => pc.area ** 1.5);
      let r = Math.random() * weights.reduce((s, w) => s + w, 0);
      let seed = arr.pieces[0];
      for (let i = 0; i < weights.length; i++) {
        if ((r -= weights[i]) <= 0) {
          seed = arr.pieces[i];
          break;
        }
      }
      const [cx, cy] = centroid(seed.poly);
      const reach = Math.sqrt(seed.area) * 0.3;
      const px = cx + rand(-reach, reach);
      const py = cy + rand(-reach, reach);
      const ang = rand(0, Math.PI);
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const targets = [seed];
      if (Math.random() < EXTEND) {
        // carry the cut on into whichever piece lies past one end of it
        const r0 = split(seed.poly, px, py, dx, dy);
        if (r0) {
          const [sx0, sy0, sx1, sy1] = r0[2];
          const ends = Math.random() < 0.5 ? [1, -1] : [-1, 1];
          for (const e of ends) {
            const [ex, ey] = e > 0 ? [sx1, sy1] : [sx0, sy0];
            const out = Math.sign((ex - sx0) * dx + (ey - sy0) * dy) || e;
            const hit = arr.pieces.find((pc) => pc !== seed && contains(pc.poly, ex + dx * out * 4, ey + dy * out * 4));
            if (hit) {
              targets.push(hit);
              break;
            }
          }
        }
      }
      const cut =
        cutPieces(arr, targets, px, py, dx, dy, shape, GAP) ??
        (targets.length > 1 ? cutPieces(arr, [seed], px, py, dx, dy, shape, GAP) : null);
      if (cut) {
        applyCut(arr, cut);
        break;
      }
    }
  }
  return withOffsets(arr);
}

// --- drawing ---

function grainTexture() {
  const tex = dotPaperCanvas(SIDE + 8, SIDE + 8, {
    base: ink,
    gray: [110, 220],
    alpha: [8, 32],
    density: 0.4,
  });
  const specks = paperCanvas(SIDE + 8, SIDE + 8, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: 650,
    speckAlpha: [40, 120],
    speckSize: [1, 2],
  });
  tex.getContext('2d').drawImage(specks, 0, 0);
  return tex;
}

const same = (A, B) => A.a === B.a && A.x === B.x && A.y === B.y;

function lerpT(out, A, B, u) {
  if (u <= 0) return Object.assign(out, A);
  if (u >= 1) return Object.assign(out, B);
  out.a = A.a + (B.a - A.a) * u;
  out.x = A.x + (B.x - A.x) * u;
  out.y = A.y + (B.y - A.y) * u;
  return out;
}

// Pose every piece between steps k0 and k1 and draw it. Pieces that share a
// move are filled as one path, so a sealed or uncut seam never shows.
function drawPose(p, S, arr, k0, k1, u) {
  const ctx = p.drawingContext;
  const ox = arr.off[k0][0] + (arr.off[k1][0] - arr.off[k0][0]) * u;
  const oy = arr.off[k0][1] + (arr.off[k1][1] - arr.off[k0][1]) * u;
  const n = arr.pieces.length;
  for (let i = 0; i < n; i++) {
    lerpT(S.cur[i], arr.pieces[i].T[k0], arr.pieces[i].T[k1], u);
    S.done[i] = false;
  }
  ctx.fillStyle = S.pattern;
  for (let i = 0; i < n; i++) {
    if (S.done[i]) continue;
    const T = S.cur[i];
    ctx.save();
    ctx.translate(ox + T.x, oy + T.y);
    ctx.rotate(T.a);
    ctx.beginPath();
    for (let j = i; j < n; j++) {
      if (S.done[j] || !same(S.cur[j], T)) continue;
      S.done[j] = true;
      const poly = arr.pieces[j].poly;
      ctx.moveTo(poly[0], poly[1]);
      for (let v = 2; v < poly.length; v += 2) ctx.lineTo(poly[v], poly[v + 1]);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }
  return [ox, oy];
}

function drawScore(p, arr, k, ox, oy, reach, alpha) {
  if (alpha <= 0) return;
  const ctx = p.drawingContext;
  ctx.strokeStyle = `rgba(${bg},${bg},${bg},${alpha})`;
  ctx.lineWidth = LINE;
  for (const s of arr.steps[k].segs) {
    ctx.save();
    ctx.translate(ox + s.T.x, oy + s.T.y);
    ctx.rotate(s.T.a);
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x0 + (s.x1 - s.x0) * reach, s.y0 + (s.y1 - s.y0) * reach);
    ctx.stroke();
    ctx.restore();
  }
}

// --- state ---

function lastStep(arr) {
  return arr.pieces[0].T.length - 1;
}

function nextArrangement(S) {
  S.cycle = (S.cycle + 1) % 3;
  return S.cycle === 0 ? originalArrangement() : randomArrangement();
}

function enter(p, S, phase, extra = {}) {
  p.cancelScheduled();
  S.phase = phase;
  S.t = 0;
  S.armed = false;
  Object.assign(S, extra);
  p.loop();
}

// Hold the current frame and come back after `sec`.
function hold(p, S, sec, then) {
  if (S.armed) return;
  S.armed = true;
  p.schedule(() => then(), sec * 1000);
  p.noLoop();
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  bg,
  fps: 30,
  init(p, S) {
    const tex = grainTexture();
    S.pattern = p.drawingContext.createPattern(tex, 'no-repeat');
    S.pattern.setTransform(new DOMMatrix([1, 0, 0, 1, X0 - 4, Y0 - 4]));
    S.cur = Array.from({ length: MAX_PIECES }, () => ({ a: 0, x: 0, y: 0 }));
    S.done = new Array(MAX_PIECES).fill(false);
    S.arr = originalArrangement();
    S.cycle = 0;
    S.phase = 'rest';
    S.restFor = S.arr.hold;
    S.t = 0;
    S.armed = false;
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    const arr = S.arr;
    const K = lastStep(arr);
    S.t += dt;

    if (S.phase === 'rest') {
      drawPose(p, S, arr, K, K, 0);
      hold(p, S, S.restFor, () => enter(p, S, 'mend'));
    } else if (S.phase === 'mend') {
      const u = smooth(Math.min(S.t / MEND, 1));
      drawPose(p, S, arr, K, 0, u);
      if (S.t >= MEND) enter(p, S, 'sealed', { next: nextArrangement(S) });
    } else if (S.phase === 'sealed') {
      drawPose(p, S, arr, 0, 0, 0);
      hold(p, S, SEALED, () => {
        enter(p, S, 'break', {
          arr: S.next,
          step: 1,
          stepEnd: lastStep(S.next),
          restFor: S.next.hold,
        });
        S.next = null;
      });
    } else {
      // break: score this step's line, then ease its halves apart
      const t = S.t;
      const u = smooth(Math.min(Math.max((t - SCORE) / SPLIT, 0), 1));
      const [ox, oy] = drawPose(p, S, arr, S.step - 1, S.step, u);
      const reach = 1 - (1 - Math.min(t / SCORE, 1)) ** 2;
      drawScore(p, arr, S.step, ox, oy, reach, 1 - Math.min(Math.max((t - SCORE) / (SPLIT * 0.4), 0), 1));
      if (t >= SCORE + SPLIT + PAUSE) {
        if (S.step < S.stepEnd) [S.step, S.t] = [S.step + 1, 0];
        else enter(p, S, 'rest');
      }
    }
  },
  onActivate(p, S) {
    S.armed = false; // a hold timer was cancelled while hidden; re-arm it
  },
  mousePressed(p, S) {
    // settle whatever is moving onto a resting fracture first
    if (S.phase === 'sealed' && S.next) S.next = null;
    const arr = S.arr;
    const K = lastStep(arr);
    if (K >= MAX_CUTS) return;
    const [ox, oy] = arr.off[K];
    const hit = arr.pieces.find((pc) => {
      const T = pc.T[K];
      const [x, y] = apply({ a: -T.a, x: 0, y: 0 }, S.mouseX - ox - T.x, S.mouseY - oy - T.y);
      return contains(pc.poly, x, y);
    });
    if (!hit) return;
    const [px, py] = apply({ a: -hit.T[K].a, x: 0, y: 0 }, S.mouseX - ox - hit.T[K].x, S.mouseY - oy - hit.T[K].y);
    const shape = [900, 0.25, (12 * Math.PI) / 180];
    for (let tries = 0; tries < 24; tries++) {
      const ang = rand(0, Math.PI);
      const cut = cutPieces(arr, [hit], px, py, Math.cos(ang), Math.sin(ang), shape, [4, 18]);
      if (!cut) continue;
      applyCut(arr, cut);
      arr.off.push(arr.off[K]); // keep the arrangement still under the cursor
      S.cycle = 2; // heal back into the original
      enter(p, S, 'break', { step: K + 1, stepEnd: K + 1, restFor: HEAL });
      return;
    }
  },
});
