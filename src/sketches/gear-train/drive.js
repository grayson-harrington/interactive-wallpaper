// Who drives whom, how fast, and whether it locks up.
//
// Every gear's angle is k * theta + b, where theta is the source's turned
// angle. Rebuilding the mesh/belt graph and walking it from the source gives
// each gear its k (speed relative to the source; sign = direction) and b (a
// phase that slots its teeth into the gaps of the gear driving it). Because
// the phase follows from the driver, gears that were already turning don't
// jump when the topology changes. Two paths that ask a gear for different k
// (an odd loop of meshes, a belt fighting a mesh) lock the whole train.

import { pitchR, maxTeeth } from './geometry.js';

const EPS = 1e-6;

export function solve(board) {
  const { gears, belts, m, theta } = board;
  const tol = 0.5 * m;
  const live = [];
  for (const g of gears) {
    if (g.dying) continue;
    g.cur = g.k * theta + g.b;
    g.adj = [];
    g.seen = false;
    g.comp = -1;
    live.push(g);
  }
  const edges = [];
  for (let i = 0; i < live.length; i++) {
    const a = live[i];
    for (let j = i + 1; j < live.length; j++) {
      const b = live[j];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      for (const ra of a.rings) {
        for (const rb of b.rings) {
          if (ra.layer !== rb.layer) continue;
          const ka = pitchR(ra.teeth, m);
          if (Math.abs(d - ka - pitchR(rb.teeth, m)) > tol) continue;
          const e = { type: 'mesh', a, b, ta: ra.teeth, tb: rb.teeth, used: false, bad: false };
          e.x = a.x + ((b.x - a.x) / d) * ka;
          e.y = a.y + ((b.y - a.y) / d) * ka;
          edges.push(e);
          a.adj.push(e);
          b.adj.push(e);
        }
      }
    }
  }
  for (const bl of belts) {
    if (bl.a.dying || bl.b.dying) continue;
    const e = { type: 'belt', a: bl.a, b: bl.b, ta: maxTeeth(bl.a), tb: maxTeeth(bl.b), used: false, bad: false };
    edges.push(e);
    bl.a.adj.push(e);
    bl.b.adj.push(e);
  }

  // walk each connected component; the source's first so it is component 0
  const source = live.find((g) => g.fixed === 'source');
  const order = source ? [source, ...live.filter((g) => g !== source)] : live;
  const jammedComps = new Set();
  let comp = 0;
  for (const root of order) {
    if (root.seen) continue;
    root.seen = true;
    root.comp = comp;
    root.k = 1;
    root.b = root === source ? 0 : root.cur - theta;
    const queue = [root];
    for (let qi = 0; qi < queue.length; qi++) {
      const from = queue[qi];
      for (const e of from.adj) {
        if (e.used) continue;
        e.used = true;
        const to = e.a === from ? e.b : e.a;
        const tf = e.a === from ? e.ta : e.tb;
        const tt = e.a === from ? e.tb : e.ta;
        const ratio = tf / tt;
        let k;
        let b;
        if (e.type === 'mesh') {
          const phi = Math.atan2(to.y - from.y, to.x - from.x);
          k = -ratio * from.k;
          b = -ratio * (from.b - phi) + phi + Math.PI + Math.PI / tt;
        } else {
          k = ratio * from.k;
          b = to.cur - k * theta;
        }
        if (!to.seen) {
          to.seen = true;
          to.comp = comp;
          to.k = k;
          to.b = b;
          queue.push(to);
        } else if (Math.abs(k - to.k) > EPS * Math.max(1, Math.abs(k))) {
          e.bad = true;
          jammedComps.add(comp);
        }
      }
    }
    comp++;
  }

  // only the source's component turns; everything else holds its pose
  for (const g of live) {
    g.driven = !!source && g.comp === 0;
    g.jammed = jammedComps.has(g.comp);
    if (!g.driven) {
      g.b = g.k * theta + g.b;
      g.k = 0;
    }
  }
  board.edges = edges;
  board.jammed = !!source && jammedComps.has(0);
  return board.jammed;
}
