// Flow Pipes  (new: a "net"/pipe-rotation puzzle)
//
// Every cell holds a pipe piece (end, straight, bend, tee). The map is a
// random spanning tree grown from a randomly placed water source, so there
// is always a solution that connects every pipe; each piece then gets a
// random rotation. Click a pipe to rotate it clockwise. Pipes connected to the source fill
// with water, which flows
// outward piece by piece; disconnecting a pipe drains everything past it.
// When every pipe is connected the board celebrates briefly, then a new
// puzzle is generated.
//
// Ambient mode: an invisible player solves the board slowly, preferring
// pipes next to the water so the flow visibly spreads.
// Settings: grid size (cell size) in the panel; remembered per browser.

import { createPanel, autoFade } from '../lib/panel.js';

// edge bits
const N = 1;
const E = 2;
const S = 4;
const W = 8;
const DIRS = [
  [N, 0, -1, S],
  [E, 1, 0, W],
  [S, 0, 1, N],
  [W, -1, 0, E],
];
const rotCW = (m) => ((m << 1) | (m >> 3)) & 15;

const SIZE_KEY = 'iw:pipes:cell';
const FILL_RATE = 0.22; // per frame
const DRAIN_RATE = 0.25;
const SOLVED_HOLD_MS = 5000;

const COLORS = {
  bg: '#101820',
  pipe: '#3a4b5a',
  pipeLit: '#4f6577',
  water: '#4fc3f7',
};

export default function flowPipes(p) {
  let cellPx = 64;
  try {
    cellPx = Number(localStorage.getItem(SIZE_KEY)) || cellPx;
  } catch {
    // storage unavailable
  }

  let cols;
  let rows;
  let ox;
  let oy;
  let cells = []; // { mask, solved, turns (display angle in quarter turns), fill, parentDir }
  let source;
  let solvedAt = 0;
  let aiCooldown = 0;

  const at = (i, j) => (i >= 0 && j >= 0 && i < cols && j < rows ? cells[i + j * cols] : null);

  // ---- generation --------------------------------------------------------

  function generate() {
    cols = Math.max(3, Math.floor((p.width - 40) / cellPx));
    rows = Math.max(3, Math.floor((p.height - 40) / cellPx));
    ox = Math.floor((p.width - cols * cellPx) / 2);
    oy = Math.floor((p.height - rows * cellPx) / 2);
    cells = Array.from({ length: cols * rows }, (_, k) => ({ i: k % cols, j: Math.floor(k / cols), mask: 0 }));
    source = cells[Math.floor(Math.random() * cells.length)];

    // randomized Prim's: grow a tree from the source. Branchy trees make
    // better puzzles than long DFS corridors.
    const inTree = new Set([source]);
    const frontier = [];
    const addFrontier = (c) => {
      for (const [bit, di, dj, opp] of DIRS) {
        const n = at(c.i + di, c.j + dj);
        if (n && !inTree.has(n)) frontier.push([c, n, bit, opp]);
      }
    };
    addFrontier(source);
    while (frontier.length) {
      const [from, to, bit, opp] = frontier.splice(Math.floor(Math.random() * frontier.length), 1)[0];
      if (inTree.has(to)) continue;
      // avoid 4-way crosses (not a piece in this game)
      if ([N, E, S, W].every((b) => b === bit || from.mask & b)) continue;
      from.mask |= bit;
      to.mask |= opp;
      inTree.add(to);
      addFrontier(to);
    }
    // the no-cross rule can (rarely) strand a cell; that board is unsolvable
    if (inTree.size < cells.length) return generate();

    for (const c of cells) {
      c.solved = c.mask;
      const r = Math.floor(Math.random() * 4);
      for (let k = 0; k < r; k++) c.mask = rotCW(c.mask);
      c.turns = 0;
      c.fill = 0;
      c.parentDir = null;
    }
    solvedAt = 0;
  }

  // ---- connectivity --------------------------------------------------------

  // BFS through mutually open edges; records the direction water comes from
  function flood() {
    for (const c of cells) {
      c.connected = false;
      c.parentDir = null;
    }
    source.connected = true;
    const queue = [source];
    let count = 1;
    while (queue.length) {
      const c = queue.shift();
      for (const [bit, di, dj, opp] of DIRS) {
        if (!(c.mask & bit)) continue;
        const n = at(c.i + di, c.j + dj);
        if (!n || n.connected || !(n.mask & opp)) continue;
        n.connected = true;
        n.parent = c;
        n.parentDir = opp;
        queue.push(n);
        count++;
      }
    }
    return count;
  }

  function isSolved(connectedCount) {
    if (connectedCount !== cells.length) return false;
    // no open ends pointing at a wall or an unmatched neighbor
    for (const c of cells) {
      for (const [bit, di, dj, opp] of DIRS) {
        if (!(c.mask & bit)) continue;
        const n = at(c.i + di, c.j + dj);
        if (!n || !(n.mask & opp)) return false;
      }
    }
    return true;
  }

  function rotate(c, dir = 1) {
    if (solvedAt) return;
    c.mask = dir > 0 ? rotCW(c.mask) : rotCW(rotCW(rotCW(c.mask)));
    c.turns -= dir; // display catches up (animated)
  }

  // ---- ambient solver ------------------------------------------------------

  function aiStep() {
    const touchesWater = (c) =>
      DIRS.some(([, di, dj]) => {
        const n = at(c.i + di, c.j + dj);
        return n && n.connected;
      });
    // a connected pipe with an arm that leads nowhere (wall or a neighbor
    // that doesn't open back toward it)
    const hasOpenEnd = (c) =>
      DIRS.some(([bit, di, dj, opp]) => {
        if (!(c.mask & bit)) return false;
        const n = at(c.i + di, c.j + dj);
        return !n || !(n.mask & opp);
      });
    // a frontier pipe that a watered pipe has an open arm pointing into -
    // rotating it to face back is what extends the flow
    const fedByWater = (c) =>
      DIRS.some(([, di, dj, opp]) => {
        const n = at(c.i + di, c.j + dj);
        return n && n.connected && n.mask & opp;
      });
    // candidates, in priority order (never settled, fully joined pipes):
    // 1. frontier pipes a dangling opening points into
    // 2. watered pipes that still have a dangling opening
    // 3. any frontier pipe next to the water
    // 4. stuck: some misrotated pipe elsewhere in the water is blocking a branch
    const unsolved = cells.filter((c) => c.mask !== c.solved);
    const tiers = [
      () => unsolved.filter((c) => !c.connected && fedByWater(c)),
      () => unsolved.filter((c) => c.connected && hasOpenEnd(c)),
      () => unsolved.filter((c) => !c.connected && touchesWater(c)),
      () => unsolved.filter((c) => c.connected),
    ];
    let pool = [];
    for (const tier of tiers) if ((pool = tier()).length) break;
    if (pool.length) rotate(pool[Math.floor(Math.random() * pool.length)]);
  }

  // ---- drawing -------------------------------------------------------------

  // Pipes are drawn with flat ends that stop exactly at the cell edge, so
  // neighbouring pipes (and their water) join seamlessly.
  function drawCell(ctx, c) {
    const x = ox + c.i * cellPx + cellPx / 2;
    const y = oy + c.j * cellPx + cellPx / 2;
    const half = cellPx / 2;
    const pipeW = Math.max(4, cellPx * 0.28);
    const waterW = pipeW * 0.5;

    // the mask is already rotated; `turns` is the leftover display rotation
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((c.turns * Math.PI) / 2);

    const arms = DIRS.filter(([bit]) => c.mask & bit).map(([bit, di, dj]) => [bit, di * half, dj * half]);
    const arm = (dx, dy, from, to, w) => {
      // rectangle along the arm from fraction `from` to `to` of its length
      const x0 = dx * from;
      const y0 = dy * from;
      const x1 = dx * to;
      const y1 = dy * to;
      ctx.fillRect(Math.min(x0, x1) - (dx ? 0 : w / 2), Math.min(y0, y1) - (dy ? 0 : w / 2), dx ? Math.abs(x1 - x0) : w, dy ? Math.abs(y1 - y0) : w);
    };

    ctx.fillStyle = c.connected ? COLORS.pipeLit : COLORS.pipe;
    for (const [, dx, dy] of arms) arm(dx, dy, 0, 1, pipeW);
    // joint: a circle rather than a square, so the outside corner of bends
    // (and the back of tees) is rounded while connecting edges stay flat
    ctx.beginPath();
    ctx.arc(0, 0, pipeW / 2, 0, Math.PI * 2);
    ctx.fill();
    const capped = arms.length === 1; // dead end: a round cap marks the end of the line
    if (capped) {
      ctx.beginPath();
      ctx.arc(0, 0, pipeW * 0.95, 0, Math.PI * 2);
      ctx.fill();
    }

    // water: in from the parent's side to the center, then out the others
    if (c.fill > 0.001) {
      ctx.fillStyle = COLORS.water;
      const inAmt = c === source ? 1 : Math.min(1, c.fill * 2);
      const outAmt = c === source ? c.fill : Math.max(0, c.fill * 2 - 1);
      for (const [bit, dx, dy] of arms) {
        if (bit === c.parentDir) arm(dx, dy, 1 - inAmt, 1, waterW);
        else if (outAmt > 0) arm(dx, dy, 0, outAmt, waterW);
      }
      if (inAmt >= 1) {
        if (capped) {
          ctx.beginPath();
          // same rim thickness as the straight sections: (pipeW - waterW) / 2
          const capR = pipeW * 0.95 - (pipeW - waterW) / 2;
          ctx.arc(0, 0, capR * Math.min(1, (c.fill - 0.5) * 2 + 0.3), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, waterW / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---- p5 ------------------------------------------------------------------

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    p.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    const parent = p.canvas.parentElement;
    const panel = createPanel(parent, { title: 'Flow Pipes', toggleLabel: 'Settings' });
    panel.toggle.classList.add('corner-br');
    panel.el.classList.add('corner-br');
    panel.range('Grid size (cell px)', { min: 28, max: 140, step: 4, value: cellPx, format: (v) => `${v}px` }, (v) => {
      cellPx = v;
      try {
        localStorage.setItem(SIZE_KEY, String(v));
      } catch {
        // storage unavailable
      }
      generate();
    });
    panel.buttons([
      ['New puzzle', generate],
      ['Hide', () => panel.hide()],
    ]);
    panel.note('Click a pipe to rotate it. Connect every pipe to the water.');
    autoFade([panel.el, panel.toggle], 10_000);
    generate();
  };

  p.draw = () => {
    const live = p.interactive();
    const connected = flood();

    if (!solvedAt && isSolved(connected)) solvedAt = performance.now();
    if (solvedAt && performance.now() - solvedAt > SOLVED_HOLD_MS) generate();

    if (!live && !solvedAt && --aiCooldown <= 0) {
      aiStep();
      aiCooldown = 12 + Math.floor(Math.random() * 18);
    }

    // water flows from full parents into connected children; drains otherwise
    source.fill = Math.min(1, source.fill + FILL_RATE);
    for (const c of cells) {
      if (c === source) continue;
      if (c.connected && c.parent && c.parent.fill >= 1) c.fill = Math.min(1, c.fill + FILL_RATE);
      else if (!c.connected) c.fill = Math.max(0, c.fill - DRAIN_RATE);
    }
    // rotation animation
    for (const c of cells) {
      if (c.turns !== 0) c.turns = Math.abs(c.turns) < 0.05 ? 0 : c.turns * 0.6;
    }

    p.background(COLORS.bg);
    const ctx = p.drawingContext;
    for (const c of cells) drawCell(ctx, c);

    if (solvedAt) {
      const t = (performance.now() - solvedAt) / 1000;
      ctx.fillStyle = `rgba(79,195,247,${0.12 * Math.max(0, Math.sin(t * 3))})`;
      ctx.fillRect(ox, oy, cols * cellPx, rows * cellPx);
    }

  };

  p.mousePressed = () => {
    const i = Math.floor((p.mouseX - ox) / cellPx);
    const j = Math.floor((p.mouseY - oy) / cellPx);
    const c = at(i, j);
    if (c && p.mouseButton === p.LEFT) rotate(c);
    return false;
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    generate();
  };
}
