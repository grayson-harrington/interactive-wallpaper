// Tree Patterns  (Processing Round 3/Tree_Patterns)
//
// "A design and algorithm developed during my mission in Honduras."
// Random non-overlapping colored nodes are scattered over the canvas, then a
// tree grows upward from a red root one generation per frame:
//   WHITE keep the number of branches   BLUE +1 branch   ORANGE -1 branch
//   RED   branch finished               YELLOW branch dead
// Branches can't cross, can't pass too close to other nodes, must point
// upward within an angle limit, and bend at least childParentAngle from the
// parent branch. Unconnected nodes shrink away; finished red paths are traced
// back to the root in red.
//
// Drawn as ink on warm paper with muted node colors, and the defaults are
// tuned so the tree spreads across most of the screen.
//
// Ambient: grows a tree, holds it for a while, fades it into the paper, grows
// a new one.
// Interactive: the original's adjuster screen is a control panel (press "a" or
// use the Controls button); Enter or a click grows a new tree. Settings are
// remembered in browser storage.

import { createPanel, autoFade } from '../lib/panel.js';
import { paperCanvas } from '../lib/paper.js';

const PAPER = [239, 233, 221];
const INK = '#3a3631';

const COLORS = {
  white: '#fbf8f1',
  red: '#b8503c',
  yellow: '#d9ae45',
  blue: '#4f6f94',
  orange: '#d18a4f',
};

const DEFAULTS = {
  whiteProb: 57,
  redProb: 6,
  yellowProb: 6,
  blueProb: 17,
  orangeProb: 11,
  minD: 15,
  minSize: 20,
  maxSize: 55,
  maxBranchLength: 65,
  minAngle: 8,
  childParentAngle: 95,
  minDistanceFromBranch: 5,
  fadeSpeed: 1, // px per frame the unconnected nodes shrink
};

const ADJUSTERS = [
  ['whiteProb', 'White density', 0, 100],
  ['redProb', 'Red density', 0, 100],
  ['yellowProb', 'Yellow density', 0, 100],
  ['blueProb', 'Blue density', 0, 100],
  ['orangeProb', 'Orange density', 0, 100],
  ['minD', 'Distance between nodes', 5, 50],
  ['minSize', 'Minimum node size', 10, 40],
  ['maxSize', 'Maximum node size', 15, 70],
  ['maxBranchLength', 'Branch length', 20, 100],
  ['minAngle', 'Angle from horizontal', 0, 75],
  ['childParentAngle', 'Angle between parent and child', 0, 180],
  ['minDistanceFromBranch', 'Distance between node and other branch', 0, 30],
  ['fadeSpeed', 'Unconnected node fade speed', 0.1, 5, 0.1],
];

const LEGEND = [
  ['white', 'White', 'keeps the same number of branches'],
  ['blue', 'Blue', 'adds a branch'],
  ['orange', 'Orange', 'drops a branch'],
  ['red', 'Red', 'finishes the branch (a goal)'],
  ['yellow', 'Yellow', 'kills the branch (dead end)'],
];

const HOLD_MS = 45_000;
const FADE_MS = 2500;
const STORAGE_KEY = 'iw:tree-patterns';

const random = (a, b) => a + Math.random() * (b - a);

// ---- geometry helpers from Tree_Build.pde ---------------------------------

function distToSegment(px, py, vx, vy, wx, wy) {
  const l2 = (vx - wx) ** 2 + (vy - wy) ** 2;
  if (l2 === 0) return Math.hypot(px - vx, py - vy);
  let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
  if (t < 0) return Math.hypot(px - vx, py - vy);
  if (t > 1) return Math.hypot(px - wx, py - wy);
  return Math.hypot(px - (vx + t * (wx - vx)), py - (vy + t * (wy - vy)));
}

function orientation(px, py, qx, qy, rx, ry) {
  const val = Math.trunc((qy - py) * (rx - qx) - (qx - px) * (ry - qy));
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(px, py, qx, qy, rx, ry) {
  return qx <= Math.max(px, rx) && qx >= Math.min(px, rx) && qy <= Math.max(py, ry) && qy >= Math.min(py, ry);
}

function pointsSame(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  return (
    (p1x === p2x && p1y === p2y) ||
    (q1x === q2x && q1y === q2y) ||
    (p1x === q2x && p1y === q2y) ||
    (q1x === p2x && q1y === p2y)
  );
}

function checkIntersection(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y) {
  if (pointsSame(p1x, p1y, q1x, q1y, p2x, p2y, q2x, q2y)) return false;
  const o1 = orientation(p1x, p1y, q1x, q1y, p2x, p2y);
  const o2 = orientation(p1x, p1y, q1x, q1y, q2x, q2y);
  const o3 = orientation(p2x, p2y, q2x, q2y, p1x, p1y);
  const o4 = orientation(p2x, p2y, q2x, q2y, q1x, q1y);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1x, p1y, p2x, p2y, q1x, q1y)) return true;
  if (o2 === 0 && onSegment(p1x, p1y, q2x, q2y, q1x, q1y)) return true;
  if (o3 === 0 && onSegment(p2x, p2y, p1x, p1y, q2x, q2y)) return true;
  if (o4 === 0 && onSegment(p2x, p2y, q1x, q1y, q2x, q2y)) return true;
  return false;
}

function angleBetween(ax, ay, bx, by) {
  const d = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (d === 0) return 0;
  return Math.acos(Math.min(1, Math.max(-1, (ax * bx + ay * by) / d)));
}

const DEG = 180 / Math.PI;

// ---------------------------------------------------------------------------

export default function treePatterns(p) {
  let settings = { ...DEFAULTS };
  try {
    settings = { ...settings, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    // no saved settings
  }

  let nodes = [];
  let currentGeneration = [];
  let nextGeneration = [];
  let reds = [];
  let finished = false;
  let holdScheduled = false;
  let fadeStart = -1; // >= 0 while the finished tree fades into the paper
  let paper; // offscreen paper texture at device resolution
  let k = 1; // px scale vs. the original 850px-tall canvas
  let panel;
  let warning;

  const S = (name) => settings[name] * (['minD', 'minSize', 'maxSize', 'maxBranchLength', 'minDistanceFromBranch'].includes(name) ? k : 1);

  function makeNode(color, x, y, s) {
    return { color, x, y, s, connected: false, connectable: true, numChildren: 0, children: [], parent: null };
  }

  function touches(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y) - a.s / 2 - b.s / 2 < S('minD');
  }

  function pickColor() {
    const { whiteProb, redProb, yellowProb, blueProb, orangeProb } = settings;
    const sum = whiteProb + redProb + yellowProb + blueProb + orangeProb;
    const r = Math.floor(random(0, sum));
    if (r < whiteProb) return 'white';
    if (r < whiteProb + redProb) return 'red';
    if (r < whiteProb + redProb + yellowProb) return 'yellow';
    if (r < whiteProb + redProb + yellowProb + blueProb) return 'blue';
    return 'orange';
  }

  function initiateMap() {
    const width = p.width;
    const height = p.height;
    k = height / 850;
    nodes = [];
    currentGeneration = [];
    nextGeneration = [];
    reds = [];
    finished = false;
    holdScheduled = false;
    const minSize = S('minSize');
    const maxSize = Math.max(S('maxSize'), minSize + 1);

    let st = 0;
    while (st < 5000) {
      st++;
      let color;
      let x;
      let y;
      let s;
      if (nodes.length === 0) {
        color = 'red';
        s = random(minSize, maxSize);
        x = random((width * 3) / 7, (5 * width) / 7);
        y = random(height - height / 15, height - s / 2);
      } else {
        color = pickColor();
        s = random(minSize, maxSize);
        x = random(s / 2, width - s / 2);
        y = color === 'red' ? random(s / 2, height - height / 3) : random(s / 2, height - s / 2);
      }
      const node = makeNode(color, x, y, s);
      if (nodes.length === 0) {
        node.connected = true;
        node.numChildren = Math.floor(random(3, 6));
        reds.push(node);
        nodes.push(node);
        currentGeneration.push(node);
      } else if (!nodes.some((n) => touches(n, node))) {
        st = 0;
        nodes.push(node);
        if (color === 'red') reds.push(node);
      }
    }
  }

  function removeUnconnectables() {
    let minY = 0;
    for (const node of currentGeneration) if (node.y > minY) minY = node.y;
    for (const node of nodes) if (node.y > minY || node.connected) node.connectable = false;
  }

  function buildTree() {
    removeUnconnectables();
    nextGeneration = [];
    const maxBranchLength = S('maxBranchLength');
    const minAngle = settings.minAngle;
    const childParentAngle = settings.childParentAngle;
    const minDistanceFromBranch = S('minDistanceFromBranch');

    for (const one of currentGeneration) {
      let possible = nodes.filter(
        (two) =>
          Math.hypot(one.x - two.x, one.y - two.y) - one.s / 2 - two.s / 2 <= maxBranchLength &&
          two.connectable &&
          two.y < one.y,
      );
      const toRemove = new Set();

      // angle from the horizontal
      for (const node of possible) {
        const a = angleBetween(1, 0, node.x - one.x, node.y - one.y) * DEG;
        if (a < minAngle || a > 180 - minAngle) toRemove.add(node);
      }

      // no crossing existing branches
      for (const pnode of possible) {
        for (const onode of nodes) {
          if (!onode.connected) continue;
          if (onode.parent && checkIntersection(pnode.x, pnode.y, one.x, one.y, onode.x, onode.y, onode.parent.x, onode.parent.y)) {
            toRemove.add(pnode);
            break;
          }
          if (onode.children.some((c) => checkIntersection(pnode.x, pnode.y, one.x, one.y, onode.x, onode.y, c.x, c.y))) {
            toRemove.add(pnode);
            break;
          }
        }
      }

      // bend relative to the parent branch
      if (one.parent) {
        for (const node of possible) {
          const a = angleBetween(node.x - one.x, node.y - one.y, one.parent.x - one.x, one.parent.y - one.y) * DEG;
          if (a < childParentAngle) toRemove.add(node);
        }
      }

      // keep clear of other nodes
      for (const node of possible) {
        for (const q of nodes) {
          if (q.x !== node.x && q.y !== node.y && q.x !== one.x && q.y !== one.y) {
            if (distToSegment(q.x, q.y, node.x, node.y, one.x, one.y) - q.s / 2 < minDistanceFromBranch) {
              toRemove.add(node);
              break;
            }
          }
        }
      }

      possible = possible.filter((n) => !toRemove.has(n));
      const gap = (n) => Math.hypot(n.x - one.x, n.y - one.y) - one.s / 2 - n.s / 2;
      possible.sort((a, b) => gap(a) - gap(b));

      if (one.numChildren > possible.length) one.numChildren = possible.length;
      for (let i = 0; i < one.numChildren; i++) {
        const child = possible[i];
        one.children.push(child);
        nextGeneration.push(child);
        child.parent = one;
        if (child.color === 'white') child.numChildren = one.numChildren;
        else if (child.color === 'red' || child.color === 'yellow') child.numChildren = 0;
        else if (child.color === 'blue') child.numChildren = one.numChildren + 1;
        else child.numChildren = one.numChildren - 1;
        child.connected = true;
        child.connectable = false;
      }
    }

    currentGeneration = nextGeneration.slice().reverse();
  }

  function showBranches(parent) {
    for (const child of parent.children) {
      p.line(parent.x, parent.y, child.x, child.y);
      showBranches(child);
    }
  }

  function connectReds(red) {
    let n = red;
    while (n.parent) {
      p.line(n.parent.x, n.parent.y, n.x, n.y);
      n = n.parent;
    }
  }

  function regenerate() {
    p.cancelScheduled();
    fadeStart = -1;
    initiateMap();
    p.loop();
  }

  function startFade() {
    fadeStart = performance.now();
    p.loop();
  }

  function buildPaper() {
    const d = p.pixelDensity();
    paper = paperCanvas(p.width * d, p.height * d, { base: PAPER, grainAlpha: [6, 14], specks: Math.round((p.width * p.height) / 2000) });
  }

  // Paper, then the tree at `alpha` (1 while growing, lower while fading).
  function paint(alpha) {
    const ctx = p.drawingContext;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(paper, 0, 0);
    ctx.restore();
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha;
    const w = Math.max(0.75, k);
    p.stroke(INK);
    p.strokeWeight(2.5 * w);
    showBranches(nodes[0]);
    if (nextGeneration.length === 0) {
      p.stroke(COLORS.red);
      p.strokeWeight(4 * w);
      for (const red of reds) if (red.connected) connectReds(red);
    }
    p.stroke(INK);
    p.strokeWeight(1.25 * w);
    for (const node of nodes) {
      p.fill(COLORS[node.color]);
      p.circle(node.x, node.y, node.s);
    }
    ctx.globalAlpha = 1;
  }

  // ---- controls ----------------------------------------------------------

  function valid() {
    return settings.minSize < settings.maxSize && settings.minD < settings.maxBranchLength;
  }

  function buildPanel() {
    const parent = p.canvas.parentElement;
    panel = createPanel(parent, { title: 'Tree Patterns', toggleLabel: 'Adjust tree (a)' });
    panel.toggle.classList.add('corner-br');
    panel.el.classList.add('corner-br');
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML =
      '<p class="note">A tree grows up from the red root at the bottom, one generation per frame. ' +
      'Each node it reaches decides how many branches continue from it:</p>' +
      LEGEND.map(([c, name, what]) => `<div><i style="background:${COLORS[c]}"></i><b>${name}</b> ${what}</div>`).join('') +
      '<p class="note">Branches never cross, keep clear of other nodes and always grow upward. ' +
      'Nodes the tree never reaches shrink away; red paths are traced back to the root.</p>';
    panel.el.append(legend);
    const sliders = {};
    const persist = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {
        // storage unavailable
      }
    };
    for (const [key, label, min, max, step = 1] of ADJUSTERS) {
      sliders[key] = panel.range(label, { min, max, step, value: settings[key] }, (v) => {
        settings[key] = v;
        persist();
        warning.hidden = valid();
      });
    }
    warning = panel.note('Min node size must be below max, and node distance below branch length.');
    warning.classList.add('warn');
    warning.hidden = valid();
    panel.buttons([
      ['Grow (Enter)', () => valid() && regenerate()],
      [
        'Defaults',
        () => {
          settings = { ...DEFAULTS };
          for (const [key] of ADJUSTERS) sliders[key].set(settings[key]);
          warning.hidden = true;
          persist();
        },
      ],
      ['Hide', () => panel.hide()],
    ]);
    panel.note('Keys: Enter grow · a adjusters. Click the tree to grow a new one. Settings are remembered.');
    autoFade([panel.el, panel.toggle]);
  }

  // ---- p5 ------------------------------------------------------------------

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    buildPanel();
    buildPaper();
    initiateMap();
  };

  p.draw = () => {
    if (fadeStart >= 0) {
      const t = Math.min(1, (performance.now() - fadeStart) / FADE_MS);
      paint(1 - t * t * (3 - 2 * t));
      if (t >= 1) {
        fadeStart = -1;
        initiateMap();
      }
      return;
    }

    if (finished) {
      if (!holdScheduled) {
        holdScheduled = true;
        p.schedule(startFade, HOLD_MS);
      }
      p.noLoop();
      return;
    }

    buildTree();
    paint(1);

    let shrinking = 0;
    nodes = nodes.filter((node) => {
      if (!node.connected) {
        node.s -= settings.fadeSpeed;
        shrinking++;
        return node.s > 0;
      }
      return true;
    });

    if (nextGeneration.length === 0 && shrinking === 0) finished = true;
  };

  // re-arm the hold timer after being switched away and back
  p.onActivate = () => {
    holdScheduled = false;
  };

  p.mouseClicked = () => {
    if (valid()) regenerate();
  };

  p.keyPressed = () => {
    if (p.keyCode === p.ENTER || p.keyCode === p.RETURN) {
      if (valid()) regenerate();
    } else if (p.key === 'a' || p.key === 'A') {
      panel.flip();
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    buildPaper();
    regenerate();
  };
}
