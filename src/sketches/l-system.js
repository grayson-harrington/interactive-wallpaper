// L-System Tool  (after Python/Projects/l-systems/main.py)
//
// The original expanded an axiom with rewrite rules and drew it with Python's
// turtle. The same core here - string rewriting plus turtle interpretation
// (position + heading, [ ] push/pop) - drawn to a canvas and auto-fitted to
// the window, with a full control panel:
//   presets, axiom, rules (one per line, "X -> ..."), which symbols draw,
//   angle, iterations, start heading, zoom, line weight and colors.
// Iterations are bounded by the length of the resulting string (the cap is
// computed before expanding, so branching systems can't blow up the page).
//
// Turtle: draw symbols (default F, G) move forward drawing, f moves without
// drawing, + / - turn left / right, | turns around, [ ] push / pop.
//
// Settings are shared through the server, so a system set up in a browser
// tab is what Plash displays. Renders once per change, otherwise idle.

import { createPanel, autoFade } from '../lib/panel.js';
import { getShared, setShared, subscribe } from '../shell/sync.js';

const MAX_LENGTH = 1_500_000;
const SHARED_KEY = 'lsystem';

export const PRESETS = [
  {
    name: 'Fractal plant (original)',
    axiom: 'X',
    rules: 'X -> F+[[X]-X]-F[-FX]+X\nF -> FF',
    draw: 'F',
    angle: 25,
    iterations: 6,
    heading: -65,
    color: '#8fd694',
    bg: '#10140f',
  },
  {
    name: 'Bush',
    axiom: 'F',
    rules: 'F -> FF+[+F-F-F]-[-F+F+F]',
    draw: 'F',
    angle: 22.5,
    iterations: 4,
    heading: -90,
    color: '#d9c38a',
    bg: '#17130c',
  },
  {
    name: 'Koch snowflake',
    axiom: 'F--F--F',
    rules: 'F -> F+F--F+F',
    draw: 'F',
    angle: 60,
    iterations: 4,
    heading: 0,
    color: '#a9d6ff',
    bg: '#0b1220',
  },
  {
    name: 'Sierpinski triangle',
    axiom: 'F-G-G',
    rules: 'F -> F-G+F+G-F\nG -> GG',
    draw: 'FG',
    angle: 120,
    iterations: 6,
    heading: 0,
    color: '#ffb38a',
    bg: '#1a0f0b',
  },
  {
    name: 'Sierpinski arrowhead',
    axiom: 'A',
    rules: 'A -> B-A-B\nB -> A+B+A',
    draw: 'AB',
    angle: 60,
    iterations: 7,
    heading: 0,
    color: '#f5d76e',
    bg: '#15130a',
  },
  {
    name: 'Dragon curve',
    axiom: 'FX',
    rules: 'X -> X+YF+\nY -> -FX-Y',
    draw: 'F',
    angle: 90,
    iterations: 12,
    heading: 0,
    color: '#ff7a8a',
    bg: '#170b0e',
  },
  {
    name: 'Hilbert curve',
    axiom: 'A',
    rules: 'A -> +BF-AFA-FB+\nB -> -AF+BFB+FA-',
    draw: 'F',
    angle: 90,
    iterations: 6,
    heading: 0,
    color: '#7fd1ae',
    bg: '#0b1511',
  },
  {
    name: 'Gosper curve',
    axiom: 'A',
    rules: 'A -> A-B--B+A++AA+B-\nB -> +A-BB--B-A++A+B',
    draw: 'AB',
    angle: 60,
    iterations: 4,
    heading: 0,
    color: '#c3a6ff',
    bg: '#110d1a',
  },
];

function fromPreset(preset) {
  const { name, ...rest } = preset;
  return { preset: name, scale: 100, weight: 1.5, ...rest };
}

export function parseRules(text) {
  const rules = {};
  for (const line of text.split(/[\n;]/)) {
    const m = line.match(/^\s*(\S)\s*(?:->|→|=|:)\s*(.*?)\s*$/);
    if (m) rules[m[1]] = m[2].replace(/\s+/g, '');
  }
  return rules;
}

// Expand, stopping early if the next iteration would exceed MAX_LENGTH.
export function expand(axiom, rules, iterations) {
  let state = axiom.replace(/\s+/g, '');
  let done = 0;
  for (; done < iterations; done++) {
    let len = 0;
    for (const ch of state) len += rules[ch] !== undefined ? rules[ch].length : 1;
    if (len > MAX_LENGTH) break;
    let next = '';
    const parts = [];
    for (const ch of state) {
      next += rules[ch] ?? ch;
      if (next.length > 65536) {
        parts.push(next);
        next = '';
      }
    }
    parts.push(next);
    state = parts.join('');
  }
  return { state, done };
}

// Turtle interpretation into a flat list of segments [x1,y1,x2,y2,...].
export function interpret(state, { angle, heading, draw }) {
  const drawSet = new Set(draw);
  const turn = (angle * Math.PI) / 180;
  let x = 0;
  let y = 0;
  let a = (heading * Math.PI) / 180;
  const stack = [];
  const segs = [];
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (const ch of state) {
    if (drawSet.has(ch) || ch === 'f') {
      const nx = x + Math.cos(a);
      const ny = y + Math.sin(a);
      if (ch !== 'f') segs.push(x, y, nx, ny);
      x = nx;
      y = ny;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else if (ch === '+') a -= turn;
    else if (ch === '-') a += turn;
    else if (ch === '|') a += Math.PI;
    else if (ch === '[') stack.push([x, y, a]);
    else if (ch === ']' && stack.length) [x, y, a] = stack.pop();
  }
  return { segs, bounds: [minX, minY, maxX, maxY] };
}

export default function lSystem(p) {
  let settings = fromPreset(PRESETS[0]);
  let result = null; // { segs, bounds, done, length }
  let dirtyGeometry = true;
  let dirty = true;
  let controls = {};
  let status;
  let shareTimer;

  function recompute() {
    const { state, done } = expand(settings.axiom, parseRules(settings.rules), settings.iterations);
    const { segs, bounds } = interpret(state, settings);
    result = { segs, bounds, done, length: state.length };
    dirtyGeometry = false;
    const capped = done < settings.iterations ? ` · capped at ${done} iterations (string too long)` : '';
    if (status) status.textContent = `${state.length.toLocaleString()} symbols · ${(segs.length / 4).toLocaleString()} lines${capped}`;
  }

  function render() {
    if (dirtyGeometry) recompute();
    const ctx = p.drawingContext;
    p.background(settings.bg);
    const { segs, bounds } = result;
    if (!segs.length) return;
    const [minX, minY, maxX, maxY] = bounds;
    const w = Math.max(maxX - minX, 1e-9);
    const h = Math.max(maxY - minY, 1e-9);
    const margin = 0.08;
    const s = Math.min((p.width * (1 - 2 * margin)) / w, (p.height * (1 - 2 * margin)) / h) * (settings.scale / 100);
    const ox = p.width / 2 - ((minX + maxX) / 2) * s;
    const oy = p.height / 2 - ((minY + maxY) / 2) * s;
    ctx.strokeStyle = settings.color;
    ctx.lineWidth = settings.weight;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let lx = NaN;
    let ly = NaN;
    for (let i = 0; i < segs.length; i += 4) {
      const x1 = ox + segs[i] * s;
      const y1 = oy + segs[i + 1] * s;
      if (x1 !== lx || y1 !== ly) ctx.moveTo(x1, y1);
      lx = ox + segs[i + 2] * s;
      ly = oy + segs[i + 3] * s;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }

  function changed({ geometry = true, share = true } = {}) {
    if (geometry) dirtyGeometry = true;
    dirty = true;
    p.loop();
    if (share) {
      clearTimeout(shareTimer);
      shareTimer = setTimeout(() => setShared(SHARED_KEY, settings), 400);
    }
  }

  function syncControls() {
    controls.preset.value = PRESETS.some((q) => q.name === settings.preset) ? settings.preset : '';
    controls.axiom.value = settings.axiom;
    controls.rules.value = settings.rules;
    controls.draw.value = settings.draw;
    controls.angle.set(settings.angle);
    controls.iterations.set(settings.iterations);
    controls.heading.set(settings.heading);
    controls.scale.set(settings.scale);
    controls.weight.set(settings.weight);
    controls.color.value = settings.color;
    controls.bg.value = settings.bg;
  }

  function buildPanel() {
    const panel = createPanel(p.canvas.parentElement, { title: 'L-System', toggleLabel: 'L-System controls', open: true });
    const set = (key, opts) => (v) => {
      settings[key] = v;
      if (key !== 'preset') settings.preset = 'Custom';
      changed(opts);
    };
    controls.preset = panel.select(
      'Preset',
      [...PRESETS.map((q) => ({ value: q.name, label: q.name })), { value: '', label: 'Custom' }],
      settings.preset,
      (name) => {
        const q = PRESETS.find((x) => x.name === name);
        if (!q) return;
        settings = { ...fromPreset(q), scale: settings.scale, weight: settings.weight };
        syncControls();
        changed();
      },
    );
    controls.axiom = panel.text('Axiom', settings.axiom, set('axiom'));
    controls.rules = panel.text('Rules (one per line: X -> ...)', settings.rules, set('rules'), { multiline: true });
    controls.draw = panel.text('Draw symbols', settings.draw, set('draw'));
    controls.angle = panel.range('Angle', { min: 0, max: 180, step: 0.5, value: settings.angle, format: (v) => `${v}°` }, set('angle'));
    controls.iterations = panel.range('Iterations', { min: 0, max: 16, value: settings.iterations }, set('iterations'));
    controls.heading = panel.range('Start heading', { min: -180, max: 180, value: settings.heading, format: (v) => `${v}°` }, set('heading'));
    controls.scale = panel.range('Zoom', { min: 10, max: 400, value: settings.scale, format: (v) => `${v}%` }, (v) => {
      settings.scale = v;
      changed({ geometry: false });
    });
    controls.weight = panel.range('Line weight', { min: 0.25, max: 8, step: 0.25, value: settings.weight }, (v) => {
      settings.weight = v;
      changed({ geometry: false });
    });
    controls.color = panel.color('Line color', settings.color, (v) => {
      settings.color = v;
      changed({ geometry: false });
    });
    controls.bg = panel.color('Background', settings.bg, (v) => {
      settings.bg = v;
      changed({ geometry: false });
    });
    status = panel.note('');
    panel.buttons([
      ['Hide', () => panel.hide()],
    ]);
    panel.note('Turtle: draw symbols go forward, f moves without drawing, + / - turn, | turns around, [ ] branch.');
    autoFade([panel.el, panel.toggle], 15_000);
  }

  p.setup = () => {
    // read shared settings here, not at construction: sync has loaded by now
    settings = { ...settings, ...(getShared(SHARED_KEY) || {}) };
    p.createCanvas(p.windowWidth, p.windowHeight);
    buildPanel();
    subscribe(SHARED_KEY, (remote) => {
      settings = { ...settings, ...remote };
      syncControls();
      changed({ share: false });
    });
  };

  p.draw = () => {
    if (dirty) {
      render();
      dirty = false;
    }
    p.noLoop();
  };

  // browsers may drop a hidden canvas's pixels; always repaint when shown
  p.onActivate = () => {
    dirty = true;
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    changed({ geometry: false, share: false });
  };
}
