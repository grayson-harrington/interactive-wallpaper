// Board generation and the invisible ambient builder for Gear Train.
//
// growStep() hangs one new gear (sometimes a compound, sometimes a belted
// gear a little way off) on the turning train, never in a spot that would
// lock it. Goal boards grow a hidden train the same way, keep a few of its
// gears as fixed targets, and remember the rest as the solution the builder
// replays in ambient mode.

import { check, beltOk, pitchR, outerR, gearOuter } from './geometry.js';
import { solve } from './drive.js';

export const SIZES = [8, 12, 16, 24, 36];
export const COMPOUNDS = [
  [36, 12],
  [24, 8],
];
export const MAX_GEARS = 60;
export const MAX_BELTS = 10;

const PLAIN_WEIGHTS = [2, 3, 3, 2, 1];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pickPlain() {
  let r = Math.random() * PLAIN_WEIGHTS.reduce((s, w) => s + w, 0);
  for (let i = 0; i < SIZES.length; i++) {
    r -= PLAIN_WEIGHTS[i];
    if (r < 0) return SIZES[i];
  }
  return SIZES[1];
}

export function makeGear(board, teeth, layers, x, y, fixed = null) {
  return {
    id: board.nextId++,
    x,
    y,
    rings: teeth.map((t, i) => ({ teeth: t, layer: layers[i] })),
    fixed,
    k: 0,
    b: Math.random() * Math.PI * 2,
    scale: 0,
    dying: false,
    driven: false,
    jammed: false,
  };
}

// Inside the screen (mostly) and clear of the settings corner.
export function fits(board, x, y, r) {
  const margin = r * 0.35;
  if (x < margin || y < margin || x > board.w - margin || y > board.h - margin) return false;
  const a = board.avoid;
  if (a) {
    const cx = Math.max(a.x, Math.min(x, a.x + a.w));
    const cy = Math.max(a.y, Math.min(y, a.y + a.h));
    if (Math.hypot(x - cx, y - cy) < r) return false;
  }
  return true;
}

export function makeSource(board) {
  const teeth = pick([12, 16, 24]);
  const r = outerR(teeth, board.m);
  for (let tries = 0; tries < 200; tries++) {
    const x = board.w * (0.15 + Math.random() * 0.7);
    const y = board.h * (0.15 + Math.random() * 0.7);
    if (fits(board, x, y, r * 1.5)) return makeGear(board, [teeth], [0], x, y, 'source');
  }
  return makeGear(board, [teeth], [0], board.w / 2, board.h / 2, 'source');
}

// Add a gear and keep it only if the train still turns. Returns the gear.
function tryAdd(board, g, belt) {
  board.gears.push(g);
  if (belt) board.belts.push(belt);
  if (solve(board)) {
    board.gears.pop();
    if (belt) board.belts.pop();
    solve(board);
    return null;
  }
  return g;
}

// One builder move. `allowBelts` is off for hidden goal trains.
export function growStep(board, { allowBelts = true, plainOnly = false } = {}) {
  if (board.gears.length >= MAX_GEARS) return null;
  const { m } = board;
  const parents = board.gears.filter((g) => g.driven && !g.dying);
  if (!parents.length) return null;
  for (let attempt = 0; attempt < 25; attempt++) {
    const parent = pick(parents);
    const ring = pick(parent.rings);
    const roll = Math.random();
    const a = Math.random() * Math.PI * 2;

    if (allowBelts && roll < 0.1 && board.belts.length < MAX_BELTS) {
      const teeth = [pickPlain()];
      const d = gearOuter(parent, m) + outerR(teeth[0], m) + m * (6 + Math.random() * 24);
      const x = parent.x + Math.cos(a) * d;
      const y = parent.y + Math.sin(a) * d;
      if (!fits(board, x, y, outerR(teeth[0], m))) continue;
      const layers = [ring.layer];
      const c = check(board, teeth, layers, x, y);
      if (!c.ok || c.meshes) continue;
      const g = makeGear(board, teeth, layers, x, y);
      board.gears.push(g);
      const ok = beltOk(board, parent, g);
      board.gears.pop();
      if (!ok) continue;
      if (tryAdd(board, g, { a: parent, b: g })) return g;
      continue;
    }

    const teeth = !plainOnly && roll < 0.25 ? pick(COMPOUNDS).slice() : [pickPlain()];
    const i = Math.floor(Math.random() * teeth.length);
    const d = pitchR(ring.teeth, m) + pitchR(teeth[i], m);
    const x = parent.x + Math.cos(a) * d;
    const y = parent.y + Math.sin(a) * d;
    const layers = teeth.length > 1 ? (i === 0 ? [ring.layer, 1 - ring.layer] : [1 - ring.layer, ring.layer]) : [ring.layer];
    if (!fits(board, x, y, outerR(Math.max(...teeth), m))) continue;
    if (!check(board, teeth, layers, x, y).ok) continue;
    const g = makeGear(board, teeth, layers, x, y);
    g.depth = (parent.depth || 0) + 1;
    if (tryAdd(board, g)) return g;
  }
  return null;
}

// Grow a hidden train from the source and keep 1-3 of its plain back-layer
// gears as targets. Returns { targets, hidden } or null (caller retries).
export function makeGoals(board) {
  const source = board.gears.find((g) => g.fixed === 'source');
  const sim = { ...board, gears: [source], belts: [], nextId: board.nextId };
  source.depth = 0;
  solve(sim);
  const want = 7 + Math.floor(Math.random() * 5);
  for (let n = 0, tries = 0; n < want && tries < 40; tries++) if (growStep(sim, { allowBelts: false })) n++;
  board.nextId = sim.nextId;
  // targets sit fully on screen with room for their label underneath
  const onScreen = (g) => {
    const r = gearOuter(g, board.m) + board.m * 2;
    return g.x > r && g.y > r && g.x < board.w - r && g.y < board.h - r - 30;
  };
  const pool = sim.gears.filter(
    (g) => g.rings.length === 1 && g.rings[0].layer === 0 && g.depth >= 3 && Math.abs(Math.abs(g.k) - 1) > 1e-6 && onScreen(g),
  );
  if (!pool.length) return null;
  // spread the targets out: each next one is the farthest from those chosen
  const count = Math.min(pool.length, 1 + Math.floor(Math.random() * 3));
  const targets = [pool.splice(Math.floor(Math.random() * pool.length), 1)[0]];
  while (targets.length < count) {
    let best = 0;
    let bestD = -1;
    pool.forEach((g, idx) => {
      const d = Math.min(...targets.map((t) => Math.hypot(t.x - g.x, t.y - g.y)));
      if (d > bestD) {
        bestD = d;
        best = idx;
      }
    });
    targets.push(pool.splice(best, 1)[0]);
  }
  const hidden = sim.gears
    .filter((g) => g !== source && !targets.includes(g))
    .map((g) => ({ teeth: g.rings.map((r) => r.teeth), layers: g.rings.map((r) => r.layer), x: g.x, y: g.y }));
  return {
    targets: targets.map((t) => {
      const g = makeGear(board, [t.rings[0].teeth], [0], t.x, t.y, 'target');
      g.want = t.k;
      return g;
    }),
    hidden,
  };
}
