// Nested circle packing on the unit sphere, plus the per-frame orbit pose.
//
// Radii follow a truncated power law and are placed largest first, each at a
// random spot where it sits wholly inside one earlier circle or clear of all of
// them (edges never cross). The result is a containment tree, re-indexed
// breadth-first so every circle's children are contiguous and every parent
// comes before its children.
//
// Every circle spins about its own centre and carries its children with it, so
// poses chain down the tree: M_i = M_parent · R(c_i, ω_i t). Poses live in the
// sphere's own frame; the sphere's overall rotation is applied in the shader.

const MARGIN = 0.0025; // minimum angular gap between circle edges
const ALPHA = 2.1; // power-law exponent for radii
const BIG = 0.15; // circles at least this big are checked linearly during placement
const TRIES = 40;
const SPIN = 0.035; // ω = SPIN / radius (rad/s): small circles turn faster...
const MAX_SPIN = Math.PI / 2; // ...but never more than a turn every 4 s

// GPU lookup grid for the top-level circles (latitude bands x azimuth cells).
export const GRID_CELL = 0.06;
export const GRID_NLAT = Math.ceil(Math.PI / GRID_CELL);
export const GRID_NAZ = Math.ceil((2 * Math.PI) / GRID_CELL);

// Placement grid: every circle below BIG is listed in each cell that a
// candidate's centre could occupy while touching it.
const PLACE_CELL = 0.04;
const PLACE_NLAT = Math.ceil(Math.PI / PLACE_CELL);
const PLACE_NAZ = Math.ceil((2 * Math.PI) / PLACE_CELL);

// Texel rows for data textures are this wide (the shader uses i & 1023, i >> 10).
export const TEX_W = 1024;

function cellOf(x, y, z, cell, nlat, naz) {
  const lat = Math.asin(Math.max(-1, Math.min(1, z)));
  const az = Math.atan2(y, x);
  const b = Math.min(nlat - 1, Math.floor((lat + Math.PI / 2) / cell));
  const a = Math.min(naz - 1, Math.floor((az + Math.PI) / cell));
  return b * naz + a;
}

// Calls fn(cell) for every cell that a cap of angular radius r around (x,y,z)
// can reach (conservatively, with a cell of slack in azimuth).
function forCapCells(x, y, z, r, cell, nlat, naz, fn) {
  const lat = Math.asin(Math.max(-1, Math.min(1, z)));
  const az = Math.atan2(y, x);
  const lo = Math.max(0, Math.floor((lat - r + Math.PI / 2) / cell));
  const hi = Math.min(nlat - 1, Math.floor((lat + r + Math.PI / 2) / cell));
  let half = naz;
  if (Math.abs(lat) + r < Math.PI / 2 - 1e-3) {
    const daz = Math.asin(Math.min(1, Math.sin(r) / Math.cos(lat)));
    half = Math.ceil(daz / cell) + 1;
  }
  const ac = Math.min(naz - 1, Math.floor((az + Math.PI) / cell));
  for (let b = lo; b <= hi; b++) {
    const row = b * naz;
    if (2 * half + 1 >= naz) {
      for (let a = 0; a < naz; a++) fn(row + a);
    } else {
      for (let d = -half; d <= half; d++) fn(row + (((ac + d) % naz) + naz) % naz);
    }
  }
}

function hexRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function pickColor(colors, total) {
  let r = Math.random() * total;
  for (const [hex, w] of colors) if ((r -= w) <= 0) return hex;
  return colors[0][0];
}

// count: radii drawn (most get placed); palette: { colors: [[hex, weight]], gap }.
export function generateLayout({ count, thMin, thMax }, palette) {
  const k = 1 - Math.pow(thMin / thMax, ALPHA - 1);
  const radii = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    radii[i] = thMin * Math.pow(1 - Math.random() * k, -1 / (ALPHA - 1)); // truncated Pareto
  }
  radii.sort().reverse();

  const cx = [], cy = [], cz = [], th = [], parent = [];
  const big = [];
  const cells = new Array(PLACE_NLAT * PLACE_NAZ);

  for (let n = 0; n < count; n++) {
    const r = radii[n];
    for (let t = 0; t < TRIES; t++) {
      const z = Math.random() * 2 - 1;
      const phi = Math.random() * 2 * Math.PI;
      const s = Math.sqrt(1 - z * z);
      const x = s * Math.cos(phi), y = s * Math.sin(phi);
      let par = -1, parTh = Infinity, ok = true;
      // Earlier circles are all at least as big, so the new one can only be
      // inside one (keep the smallest such: the deepest), clear of it, or crossing.
      const test = (j) => {
        const d = Math.acos(Math.max(-1, Math.min(1, x * cx[j] + y * cy[j] + z * cz[j])));
        if (d + r < th[j] - MARGIN) {
          if (th[j] < parTh) { par = j; parTh = th[j]; }
        } else if (d <= r + th[j] + MARGIN) {
          ok = false;
        }
        return ok;
      };
      for (let i = 0; i < big.length && ok; i++) test(big[i]);
      const list = ok && cells[cellOf(x, y, z, PLACE_CELL, PLACE_NLAT, PLACE_NAZ)];
      if (list) for (let i = 0; i < list.length && ok; i++) test(list[i]);
      if (!ok) continue;

      const idx = cx.length;
      cx.push(x); cy.push(y); cz.push(z); th.push(r); parent.push(par);
      if (r >= BIG) big.push(idx);
      else {
        // a later (smaller) circle touching this one has its centre within 2r + MARGIN
        forCapCells(x, y, z, 2 * r + MARGIN, PLACE_CELL, PLACE_NLAT, PLACE_NAZ, (c) => {
          (cells[c] ??= []).push(idx);
        });
      }
      break;
    }
  }

  // Breadth-first re-index.
  const placed = cx.length;
  const kids = Array.from({ length: placed }, () => []);
  const order = [];
  for (let i = 0; i < placed; i++) {
    if (parent[i] < 0) order.push(i);
    else kids[parent[i]].push(i);
  }
  const rootCount = order.length;
  for (let h = 0; h < order.length; h++) for (const c of kids[order[h]]) order.push(c);
  const newIdx = new Int32Array(placed);
  order.forEach((old, i) => (newIdx[old] = i));

  const colors = palette.colors;
  const total = colors.reduce((a, [, w]) => a + w, 0);
  const L = {
    n: placed,
    rootCount,
    c: new Float64Array(placed * 3), // centre in the sphere's frame
    cosTh: new Float32Array(placed),
    sinTh: new Float32Array(placed),
    omega: new Float64Array(placed),
    parent: new Int32Array(placed),
    kidStart: new Int32Array(placed),
    kidCount: new Int32Array(placed),
    color: new Float32Array(placed * 3),
    gap: hexRgb(palette.gap),
  };
  order.forEach((old, i) => {
    L.c[i * 3] = cx[old]; L.c[i * 3 + 1] = cy[old]; L.c[i * 3 + 2] = cz[old];
    L.cosTh[i] = Math.cos(th[old]);
    L.sinTh[i] = Math.sin(th[old]);
    L.omega[i] = (Math.random() < 0.5 ? -1 : 1) * Math.min(MAX_SPIN, SPIN / th[old]);
    L.parent[i] = parent[old] < 0 ? -1 : newIdx[parent[old]];
    L.kidStart[i] = kids[old].length ? newIdx[kids[old][0]] : 0;
    L.kidCount[i] = kids[old].length;
    L.color.set(hexRgb(pickColor(colors, total)), i * 3);
  });

  // GPU root grid: each cell lists every top-level circle whose cap reaches it.
  const nCells = GRID_NLAT * GRID_NAZ;
  const lists = Array.from({ length: nCells }, () => []);
  for (let i = 0; i < rootCount; i++) {
    forCapCells(L.c[i * 3], L.c[i * 3 + 1], L.c[i * 3 + 2], th[order[i]] + 0.002,
      GRID_CELL, GRID_NLAT, GRID_NAZ, (c) => {
        const l = lists[c];
        if (l[l.length - 1] !== i) l.push(i);
      });
  }
  const cellData = new Float32Array(padded(nCells) * 2);
  const items = [];
  for (let c = 0; c < nCells; c++) {
    cellData[c * 2] = items.length;
    cellData[c * 2 + 1] = lists[c].length;
    for (const i of lists[c]) items.push(i);
  }
  L.cells = cellData;
  L.items = new Float32Array(padded(items.length));
  L.items.set(items);

  // Static per-circle texels: [centre.xyz, kidStart], [colour.rgb, kidCount].
  L.stat = new Float32Array(padded(placed * 2) * 4);
  for (let i = 0; i < placed; i++) {
    L.stat.set([L.c[i * 3], L.c[i * 3 + 1], L.c[i * 3 + 2], L.kidStart[i]], i * 8);
    L.stat.set([L.color[i * 3], L.color[i * 3 + 1], L.color[i * 3 + 2], L.kidCount[i]], i * 8 + 4);
  }

  // Per-frame pose output: [centre.xyz, cosθ] per circle, and scratch matrices.
  L.dyn = new Float32Array(padded(placed) * 4);
  L.mats = new Float64Array(placed * 9);
  return L;
}

function padded(texels) {
  return Math.max(1, Math.ceil(texels / TEX_W)) * TEX_W;
}

// Fills L.dyn with each circle's centre (sphere frame) at time t. Allocation-free.
// Only circles with children need their full rotation matrix.
export function updatePose(L, t) {
  const { n, c, omega, parent, kidCount, cosTh, mats, dyn } = L;
  for (let i = 0; i < n; i++) {
    const x = c[i * 3], y = c[i * 3 + 1], z = c[i * 3 + 2];
    const pi = parent[i];
    let wx = x, wy = y, wz = z;
    let m0 = 1, m1 = 0, m2 = 0, m3 = 0, m4 = 1, m5 = 0, m6 = 0, m7 = 0, m8 = 1;
    if (pi >= 0) {
      const o = pi * 9;
      m0 = mats[o]; m1 = mats[o + 1]; m2 = mats[o + 2];
      m3 = mats[o + 3]; m4 = mats[o + 4]; m5 = mats[o + 5];
      m6 = mats[o + 6]; m7 = mats[o + 7]; m8 = mats[o + 8];
      wx = m0 * x + m1 * y + m2 * z;
      wy = m3 * x + m4 * y + m5 * z;
      wz = m6 * x + m7 * y + m8 * z;
    }
    const d = i * 4;
    dyn[d] = wx; dyn[d + 1] = wy; dyn[d + 2] = wz; dyn[d + 3] = cosTh[i];
    if (kidCount[i] === 0) continue;

    // M_i = M_parent · R(c_i, ω_i t)
    const a = omega[i] * t;
    const co = Math.cos(a), si = Math.sin(a), k = 1 - co;
    const r0 = k * x * x + co, r1 = k * x * y - si * z, r2 = k * x * z + si * y;
    const r3 = k * x * y + si * z, r4 = k * y * y + co, r5 = k * y * z - si * x;
    const r6 = k * x * z - si * y, r7 = k * y * z + si * x, r8 = k * z * z + co;
    const o = i * 9;
    mats[o] = m0 * r0 + m1 * r3 + m2 * r6;
    mats[o + 1] = m0 * r1 + m1 * r4 + m2 * r7;
    mats[o + 2] = m0 * r2 + m1 * r5 + m2 * r8;
    mats[o + 3] = m3 * r0 + m4 * r3 + m5 * r6;
    mats[o + 4] = m3 * r1 + m4 * r4 + m5 * r7;
    mats[o + 5] = m3 * r2 + m4 * r5 + m5 * r8;
    mats[o + 6] = m6 * r0 + m7 * r3 + m8 * r6;
    mats[o + 7] = m6 * r1 + m7 * r4 + m8 * r7;
    mats[o + 8] = m6 * r2 + m7 * r5 + m8 * r8;
  }
}
