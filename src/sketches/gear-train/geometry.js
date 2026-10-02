// Gear shapes, placement rules and belt geometry for Gear Train.
//
// Every gear shares one tooth size (the module m, in px), so a gear with T
// teeth has pitch radius T*m/2 and two gears mesh when their centers sit
// exactly rA + rB apart on the same layer. Teeth reach m past the pitch
// circle, so anything closer than rA + rB + 2m that isn't meshing collides.

const TAU = Math.PI * 2;

export const pitchR = (teeth, m) => (teeth * m) / 2;
export const outerR = (teeth, m) => (teeth * m) / 2 + m;
export const hubR = (m) => Math.max(3, m * 1.1);
export const maxTeeth = (g) => (g.rings.length > 1 ? Math.max(g.rings[0].teeth, g.rings[1].teeth) : g.rings[0].teeth);
export const gearOuter = (g, m) => outerR(maxTeeth(g), m);

// ---- shapes ----------------------------------------------------------------

const pathCache = new Map();

// Tooth outline plus axle hole and lightening holes (fill with 'evenodd').
// `clear` keeps the holes outside a radius, for a compound's big ring whose
// middle is covered by the small ring.
export function gearPath(teeth, m, clear = 0) {
  const key = `${teeth}:${m}:${clear}`;
  let path = pathCache.get(key);
  if (path) return path;
  path = new Path2D();
  const r = pitchR(teeth, m);
  const rr = r - 1.25 * m;
  const rt = r + m;
  const pa = TAU / teeth;
  const wr = pa * 0.3;
  const wt = pa * 0.15;
  for (let i = 0; i < teeth; i++) {
    const a = i * pa;
    if (i === 0) path.moveTo(rr * Math.cos(a - wr), rr * Math.sin(a - wr));
    path.lineTo(rt * Math.cos(a - wt), rt * Math.sin(a - wt));
    path.lineTo(rt * Math.cos(a + wt), rt * Math.sin(a + wt));
    path.lineTo(rr * Math.cos(a + wr), rr * Math.sin(a + wr));
    path.arc(0, 0, rr, a + wr, a + pa - wr);
  }
  path.closePath();
  const h = hubR(m);
  path.moveTo(h, 0);
  path.arc(0, 0, h, 0, TAU);
  // lightening holes between the hub boss and the rim
  const inner = Math.max(h * 2.4, clear + m);
  const rim = rr - m * 1.2;
  if (rim - inner > m * 3) {
    const n = teeth >= 30 ? 6 : 5;
    const rm = (inner + rim) / 2;
    const hr = Math.min((rim - inner) / 2, rm * Math.sin(Math.PI / n)) * 0.72;
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) * (TAU / n);
      const cx = rm * Math.cos(a);
      const cy = rm * Math.sin(a);
      path.moveTo(cx + hr, cy);
      path.arc(cx, cy, hr, 0, TAU);
    }
  }
  pathCache.set(key, path);
  return path;
}

export function clearPathCache() {
  pathCache.clear();
}

// ---- placement ---------------------------------------------------------------

// Can a gear with these rings sit at (x, y)? Rings only interact with rings
// on the same layer. `ignore` is a gear to leave out (the one being moved).
export function check(board, teeth, layers, x, y, ignore) {
  const { m } = board;
  if (x < 0 || y < 0 || x > board.w || y > board.h) return { ok: false, meshes: 0 };
  const tol = 0.5 * m;
  let meshes = 0;
  for (const g of board.gears) {
    if (g === ignore || g.dying) continue;
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < hubR(m) * 2) return { ok: false, meshes };
    for (const ring of g.rings) {
      for (let i = 0; i < teeth.length; i++) {
        if (ring.layer !== layers[i]) continue;
        const sum = pitchR(ring.teeth, m) + pitchR(teeth[i], m);
        if (Math.abs(d - sum) <= tol) meshes++;
        else if (d < sum + 2 * m) return { ok: false, meshes };
      }
    }
  }
  // nothing may sit under a belt's straight runs
  const r = outerR(Math.max(...teeth), m) + m * 0.5;
  for (const bl of board.belts) {
    if (bl.a !== ignore && bl.b !== ignore && beltCrosses(board, bl, x, y, r)) return { ok: false, meshes };
  }
  return { ok: true, meshes };
}

const freeLayers = (teeth) => (teeth.length > 1 ? [[0, 1], [1, 0]] : [[0], [1]]);

// Where a gear dragged to (px, py) would land: snapped to the exact mesh
// distance of the nearest ring within reach (sliding around its rim), or free
// at the pointer. Returns { x, y, layers, ok }.
export function snap(board, teeth, px, py, ignore) {
  const { m } = board;
  const options = [];
  for (const g of board.gears) {
    if (g === ignore || g.dying) continue;
    let dx = px - g.x;
    let dy = py - g.y;
    let d = Math.hypot(dx, dy);
    if (d < 1e-6) {
      dx = 1;
      dy = 0;
      d = 1;
    }
    for (const ring of g.rings) {
      const R = pitchR(ring.teeth, m);
      for (let i = 0; i < teeth.length; i++) {
        const r = pitchR(teeth[i], m);
        const D = R + r;
        const err = Math.abs(d - D);
        if (err > 0.6 * r + 3 * m) continue;
        const layers = teeth.length > 1 ? (i === 0 ? [ring.layer, 1 - ring.layer] : [1 - ring.layer, ring.layer]) : [ring.layer];
        options.push({ x: g.x + (dx / d) * D, y: g.y + (dy / d) * D, layers, err });
      }
    }
  }
  options.sort((a, b) => a.err - b.err);
  for (const o of options) {
    if (check(board, teeth, o.layers, o.x, o.y, ignore).ok) return { x: o.x, y: o.y, layers: o.layers, ok: true };
  }
  for (const layers of freeLayers(teeth)) {
    if (check(board, teeth, layers, px, py, ignore).ok) return { x: px, y: py, layers, ok: true };
  }
  const o = options[0];
  return o ? { x: o.x, y: o.y, layers: o.layers, ok: false } : { x: px, y: py, layers: freeLayers(teeth)[0], ok: false };
}

// ---- belts -----------------------------------------------------------------

export const beltR = (g, m) => outerR(maxTeeth(g), m) + m * 0.4;

// The open-belt loop around two pulleys: outer tangent points at angles
// base +- alpha on both circles. Writes into `out` to stay allocation-free.
export function beltTangents(a, b, m, out) {
  const r1 = beltR(a, m);
  const r2 = beltR(b, m);
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const base = Math.atan2(b.y - a.y, b.x - a.x);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
  out.r1 = r1;
  out.r2 = r2;
  out.base = base;
  out.alpha = alpha;
  out.ax1 = a.x + r1 * Math.cos(base + alpha);
  out.ay1 = a.y + r1 * Math.sin(base + alpha);
  out.bx1 = b.x + r2 * Math.cos(base + alpha);
  out.by1 = b.y + r2 * Math.sin(base + alpha);
  out.ax2 = a.x + r1 * Math.cos(base - alpha);
  out.ay2 = a.y + r1 * Math.sin(base - alpha);
  out.bx2 = b.x + r2 * Math.cos(base - alpha);
  out.by2 = b.y + r2 * Math.sin(base - alpha);
  return out;
}

export function segDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

const tmp = {};

// A belt needs clear air: the pulleys can't touch, and neither straight run
// may cross another gear.
export function beltOk(board, a, b) {
  const { m } = board;
  if (a === b) return false;
  if (board.belts.some((bl) => (bl.a === a && bl.b === b) || (bl.a === b && bl.b === a))) return false;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d < beltR(a, m) + beltR(b, m) + m) return false;
  const t = beltTangents(a, b, m, tmp);
  for (const g of board.gears) {
    if (g === a || g === b || g.dying) continue;
    const r = gearOuter(g, m) + m * 0.5;
    if (segDist(g.x, g.y, t.ax1, t.ay1, t.bx1, t.by1) < r) return false;
    if (segDist(g.x, g.y, t.ax2, t.ay2, t.bx2, t.by2) < r) return false;
  }
  return true;
}

const runTmp = {};

// Does a circle of radius r at (x, y) touch either straight run of a belt?
export function beltCrosses(board, bl, x, y, r) {
  const t = beltTangents(bl.a, bl.b, board.m, runTmp);
  return segDist(x, y, t.ax1, t.ay1, t.bx1, t.by1) < r || segDist(x, y, t.ax2, t.ay2, t.bx2, t.by2) < r;
}

export function beltHit(board, bl, x, y) {
  const t = beltTangents(bl.a, bl.b, board.m, tmp);
  const r = board.m * 1.5;
  return segDist(x, y, t.ax1, t.ay1, t.bx1, t.by1) < r || segDist(x, y, t.ax2, t.ay2, t.bx2, t.by2) < r;
}
