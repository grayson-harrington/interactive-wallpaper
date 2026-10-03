// Neural Cellular Automata
//
// A growing neural cellular automaton (Mordvintsev et al., Distill 2020) trained
// in the NCAs repo: one small network, run by every cell on its neighbourhood,
// grows Squirtle, Charmander or Bulbasaur from a single seed cell whose colour
// says which, and regrows what is cut away. Simulated in WebGL (sim.js) and drawn
// as crisp square cells on paper.
//
// Ambient: one creature at the centre, about half the screen tall. It grows,
// holds 15 s, takes a round bite and heals, twice, then erodes to its centre,
// where the last cell becomes the next species' seed (Squirtle -> Charmander ->
// Bulbasaur). Holds draw nothing.
// Interactive: the first click zooms out to a garden twice as wide in cells,
// keeping the creature. Click to plant the selected species (up to 6 seeds until
// Clear), shift-drag or the Erase tool to cut, and watch creatures meet. Keys:
// 1-3 species, E erase tool, Space pause, C clear. The garden freezes once it
// settles (or 60 s after the last input), and after 5 idle minutes, or 15 s
// after being cleared, it collapses back into the ambient loop.

import { createPanel, createHud, autoFade } from '../../lib/panel.js';
import { msSinceInput, onInput } from '../../lib/interaction.js';
import { createSim, loadModel } from './sim.js';

const SPECIES = [
  { id: 'squirtle', label: 'Squirtle' },
  { id: 'charmander', label: 'Charmander' },
  { id: 'bulbasaur', label: 'Bulbasaur' },
];
const PAPER = [0xf4 / 255, 0xf1 / 255, 0xea / 255];
const CREATURE = 64; // cells across a grown creature (the training target)
const SPEED = 20; // steps/s; ambient always runs at this
const SPEED_RANGE = [5, 40];
const MAX_STEPS_PER_FRAME = 3;
const GROW_STEPS = 300;
const HEAL_STEPS = 250;
const HOLD_MS = 15_000;
const BITES = 2;
const BITE_RADIUS = [6, 16]; // cells
const COLLAPSE_MS = 3000;
const ZOOM_MS = 1000;
const MAX_SEEDS = 6;
const CELL_CAP = 16_000; // live cells; past it nothing new comes alive
const STATS_MS = 1000;
const SETTLED = 0.02; // mean |dRGBA| per live cell per second below which the garden is still
const FREEZE_MS = 60_000;
const RETURN_MS = 5 * 60_000;
const BRUSH_RANGE = [4, 30];
const AMBIENT_FPS = 20;
const INTERACTIVE_FPS = 30;

const ease = (t) => t * t * (3 - 2 * t);

export default function nca(p) {
  let gl = null;
  let sim = null;
  let model = null;
  let hud = null;

  // geometry, in device px
  let bufW = 0, bufH = 0;
  let ambientCell = 8, gardenCell = 4;
  let z = 0; // 0 ambient view, 1 garden view
  let zoom = null; // { from, to, t0 }

  let mode = 'ambient';
  let fps = 0;
  let acc = 0; // fractional steps owed

  // ambient
  let phase = 'idle'; // grow | hold | heal | collapse | idle
  let budget = 0;
  let bites = 0;
  let species = 0;
  let collapse = null; // { t0, r0, done }
  let holdArmed = false;

  // garden
  let selected = 0;
  let tool = 'plant';
  let brush = 10;
  let speed = SPEED;
  let paused = false;
  let frozen = false;
  let capped = false;
  let seeds = 0;
  let lastAlive = 0;
  let quietReads = 0;
  let tickArmed = false;
  let erasing = null; // { col, row } of the last brush stamp
  let full = false; // flash "Clear to plant more"

  // panel
  let ui = null;

  // ---- geometry ----------------------------------------------------------------

  function allocate() {
    bufW = gl.drawingBufferWidth;
    bufH = gl.drawingBufferHeight;
    ambientCell = Math.max(4, Math.round((0.6 * bufH) / CREATURE)); // the body fills ~85% of the target
    gardenCell = Math.max(2, Math.round(ambientCell / 2));
    sim.resize(Math.ceil(bufW / gardenCell) + 2, Math.ceil(bufH / gardenCell) + 2);
  }

  const centre = () => [Math.floor(sim.width / 2) + 0.5, Math.floor(sim.height / 2) + 0.5];

  function view() {
    const cell = ambientCell + (gardenCell - ambientCell) * ease(z);
    const [cx, cy] = centre();
    const ox = bufW / 2 - cx * cell;
    const oy = bufH / 2 - cy * cell;
    return zoom ? { cell, ox, oy } : { cell, ox: Math.round(ox), oy: Math.round(oy) };
  }

  function toCell(x, y) {
    const v = view();
    const d = p.pixelDensity();
    return [(x * d - v.ox) / v.cell, (y * d - v.oy) / v.cell];
  }

  function zoomTo(target) {
    if (z === target && !zoom) return;
    zoom = { from: z, to: target, t0: performance.now() };
  }

  // Hidden pieces must not loop; the host restarts the loop when shown.
  function run() {
    if (p.isActive()) p.loop();
  }

  // ---- ambient -------------------------------------------------------------------

  function startAmbient(k) {
    mode = 'ambient';
    species = k;
    sim.clear();
    const [cx, cy] = centre();
    sim.seed(cx, cy, rgbOf(k));
    phase = 'grow';
    budget = GROW_STEPS;
    bites = 0;
    collapse = null;
    updatePanel();
    run();
  }

  const rgbOf = (k) => model.meta.targets[SPECIES[k].id];

  function armHold() {
    if (holdArmed) return;
    holdArmed = true;
    p.schedule(() => {
      holdArmed = false;
      if (mode !== 'ambient' || phase !== 'hold') return;
      if (bites < BITES) {
        bite();
        bites++;
        phase = 'heal';
        budget = HEAL_STEPS;
      } else {
        startCollapse(Math.ceil(0.75 * CREATURE), () => startAmbient((species + 1) % SPECIES.length));
      }
      run();
    }, HOLD_MS);
  }

  // A round wipe centred in a mostly-alive 8x8 block of the creature.
  function bite() {
    const st = sim.stats();
    const picks = [];
    const n = st.block * st.block;
    for (let i = 0; i < st.blocks.length / 4; i++) if (st.blocks[i * 4] >= 0.75 * n) picks.push(i);
    if (!picks.length) return;
    const i = picks[Math.floor(Math.random() * picks.length)];
    const x = ((i % st.blockW) + Math.random()) * st.block;
    const y = (Math.floor(i / st.blockW) + Math.random()) * st.block;
    sim.erase(x, y, BITE_RADIUS[0] + Math.random() * (BITE_RADIUS[1] - BITE_RADIUS[0]));
  }

  function startCollapse(r0, done) {
    phase = 'collapse';
    collapse = { t0: performance.now(), r0, done };
  }

  // ---- garden --------------------------------------------------------------------

  function enterGarden() {
    if (mode === 'garden') return;
    mode = 'garden';
    phase = 'idle';
    collapse = null; // an interrupted collapse just heals back
    p.cancelScheduled();
    holdArmed = false;
    tickArmed = false;
    lastAlive = sim.stats().alive;
    seeds = lastAlive > 0 ? 1 : 0;
    paused = false;
    zoomTo(1);
    wake();
    armTick();
    updatePanel();
  }

  function returnToAmbient() {
    mode = 'ambient';
    paused = false;
    frozen = false;
    erasing = null;
    zoomTo(0);
    const next = (species + 1) % SPECIES.length;
    if (lastAlive > 0) startCollapse(Math.hypot(sim.width, sim.height) / 2, () => startAmbient(next));
    else startAmbient(next);
    updatePanel();
    run();
  }

  function wake() {
    frozen = false;
    quietReads = 0;
    run();
  }

  function armTick() {
    if (tickArmed || mode !== 'garden') return;
    tickArmed = true;
    p.schedule(() => {
      tickArmed = false;
      gardenTick();
      armTick();
    }, STATS_MS);
  }

  function gardenTick() {
    if (mode !== 'garden') return;
    const idle = msSinceInput();
    if (idle >= RETURN_MS || (lastAlive === 0 && !p.interactive())) {
      returnToAmbient();
      return;
    }
    if (paused || frozen) return;
    const st = sim.stats();
    lastAlive = st.alive;
    capped = st.alive > CELL_CAP;
    const still = st.activity / Math.max(1, st.alive) < (SETTLED * STATS_MS) / 1000;
    quietReads = still ? quietReads + 1 : 0;
    if (quietReads >= 2 || idle >= FREEZE_MS) frozen = true;
  }

  function plant(col, row) {
    if (seeds >= MAX_SEEDS) {
      full = true;
      updatePanel();
      return;
    }
    sim.seed(col, row, rgbOf(selected));
    seeds++;
    lastAlive = Math.max(lastAlive, 1);
    updatePanel();
    wake();
  }

  function eraseTo(col, row) {
    const from = erasing ?? { col, row };
    const d = Math.hypot(col - from.col, row - from.row);
    const n = Math.max(1, Math.ceil(d / Math.max(1, brush / 2)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      sim.erase(from.col + (col - from.col) * t, from.row + (row - from.row) * t, brush);
    }
    erasing = { col, row };
    wake();
  }

  function clearGarden() {
    enterGarden();
    sim.clear();
    seeds = 0;
    lastAlive = 0;
    full = false;
    updatePanel();
    wake();
  }

  function select(k) {
    selected = k;
    enterGarden();
    updatePanel();
  }

  function setTool(t) {
    tool = t;
    enterGarden();
    updatePanel();
    p.redraw();
  }

  function togglePause() {
    enterGarden();
    paused = !paused;
    updatePanel();
    wake();
  }

  const shiftHeld = () => p.keyIsDown(16);
  const eraseMode = () => tool === 'erase' || shiftHeld();

  // ---- frame ---------------------------------------------------------------------

  function simulating() {
    if (zoom) return true;
    if (mode === 'ambient') return phase === 'grow' || phase === 'heal' || phase === 'collapse';
    return !paused && !frozen;
  }

  function setFps() {
    const want = p.interactive() ? INTERACTIVE_FPS : AMBIENT_FPS;
    if (want !== fps) p.frameRate((fps = want));
  }

  p.setup = () => {
    p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.setAttributes({ alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    gl = p.drawingContext;
    buildPanel();
    setFps();
    loadModel(`${import.meta.env.BASE_URL}nca/`)
      .then((m) => {
        model = m;
        sim = createSim(gl, m);
        allocate();
        startAmbient(0);
      })
      .catch((e) => {
        console.warn('Neural Cellular Automata:', e);
        hud ??= createHud(p.canvas.parentElement);
        hud.set('Neural Cellular Automata needs WebGL2 with float render targets.');
      });
  };

  p.draw = () => {
    setFps();
    if (!sim) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(PAPER[0], PAPER[1], PAPER[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      p.noLoop();
      return;
    }
    const now = performance.now();
    if (zoom) {
      const t = Math.min(1, (now - zoom.t0) / ZOOM_MS);
      z = zoom.from + (zoom.to - zoom.from) * t;
      if (t >= 1) zoom = null;
    }

    const stepping = mode === 'ambient' ? phase !== 'hold' && phase !== 'idle' : !paused && !frozen;
    if (stepping) {
      acc += ((mode === 'garden' ? speed : SPEED) * Math.min(p.deltaTime, 100)) / 1000;
      const n = Math.min(MAX_STEPS_PER_FRAME, Math.floor(acc));
      acc = n === MAX_STEPS_PER_FRAME ? 0 : acc - n;
      for (let i = 0; i < n; i++) sim.step({ cap: mode === 'garden' && capped });
      budget -= n;
    }

    if (mode === 'ambient') {
      if ((phase === 'grow' || phase === 'heal') && budget <= 0) {
        phase = 'hold';
        armHold();
      } else if (phase === 'collapse') {
        const t = Math.min(1, (now - collapse.t0) / COLLAPSE_MS);
        const [cx, cy] = centre();
        sim.keepDisc(cx, cy, collapse.r0 * (1 - ease(t)));
        if (t >= 1) collapse.done();
      }
    }

    let ring = null;
    if (mode === 'garden' && eraseMode() && p.interactive()) {
      const d = p.pixelDensity();
      ring = [p.mouseX * d, p.mouseY * d, brush * view().cell];
    }
    sim.render(bufW, bufH, view(), PAPER, ring, p.pixelDensity());

    if (!simulating()) p.noLoop();
  };

  // ---- input ---------------------------------------------------------------------

  p.mousePressed = () => {
    if (!sim || p.mouseButton !== p.LEFT) return;
    if (mode === 'ambient') {
      enterGarden(); // the first click only zooms out
      return;
    }
    const [col, row] = toCell(p.mouseX, p.mouseY);
    if (col < 0 || row < 0 || col >= sim.width || row >= sim.height) return;
    if (eraseMode()) {
      erasing = null;
      eraseTo(col, row);
    } else plant(col, row);
  };

  p.mouseDragged = () => {
    if (!sim || mode !== 'garden' || !erasing) return;
    const [col, row] = toCell(p.mouseX, p.mouseY);
    eraseTo(col, row);
  };

  p.mouseReleased = () => {
    erasing = null;
  };

  p.mouseMoved = () => {
    if (sim && mode === 'garden' && eraseMode() && !p.isLooping()) p.redraw();
  };

  p.keyPressed = () => {
    if (!sim) return;
    const k = p.key;
    if (k === '1' || k === '2' || k === '3') select(Number(k) - 1);
    else if (mode !== 'garden') return;
    else if (k === 'e' || k === 'E') setTool(tool === 'erase' ? 'plant' : 'erase');
    else if (k === ' ') togglePause();
    else if (k === 'c' || k === 'C') clearGarden();
    else if (p.keyCode === 16) p.redraw(); // show the brush ring
  };

  p.keyReleased = () => {
    if (sim && mode === 'garden' && p.keyCode === 16) p.redraw();
  };

  onInput(() => {
    if (sim && mode === 'garden' && frozen && p.isActive()) wake();
  });

  // ---- panel ---------------------------------------------------------------------

  function buildPanel() {
    const panel = createPanel(p.canvas.parentElement, {
      title: 'Neural Cellular Automata',
      toggleLabel: 'Garden',
    });
    panel.toggle.classList.add('corner-br');
    panel.el.classList.add('corner-br');

    const speciesRow = panel.buttons(SPECIES.map((s, k) => [s.label, () => select(k)]));
    const seedNote = panel.note('');
    const toolRow = panel.buttons([
      ['Plant', () => setTool('plant')],
      ['Erase', () => setTool('erase')],
    ]);
    toolRow.style.marginTop = '10px';
    toolRow.style.marginBottom = '10px';
    panel.range('Brush', { min: BRUSH_RANGE[0], max: BRUSH_RANGE[1], value: brush, format: (v) => `${v} cells` }, (v) => {
      brush = v;
    });
    panel.range('Speed', { min: SPEED_RANGE[0], max: SPEED_RANGE[1], value: speed, format: (v) => `${v} steps/s` }, (v) => {
      speed = v;
    });
    const actions = panel.buttons([
      ['Pause', togglePause],
      ['Clear', clearGarden],
    ]);
    panel.note('Click to plant · shift-drag to erase · 1-3 species · E erase · Space pause · C clear');
    autoFade([panel.el, panel.toggle], 10_000);

    ui = {
      species: [...speciesRow.children],
      tools: [...toolRow.children],
      pause: actions.children[0],
      seedNote,
    };
  }

  function updatePanel() {
    if (!ui) return;
    ui.species.forEach((b, k) => b.classList.toggle('active', k === selected));
    ui.tools.forEach((b, k) => b.classList.toggle('active', (k === 1) === (tool === 'erase')));
    ui.pause.textContent = paused ? 'Resume' : 'Pause';
    const count = `${seeds}/${MAX_SEEDS} seeds`;
    ui.seedNote.textContent =
      mode !== 'garden' ? 'Click the canvas to start a garden' : full && seeds >= MAX_SEEDS ? `${count} · Clear to plant more` : count;
    if (seeds < MAX_SEEDS) full = false;
  }

  // ---- lifecycle -----------------------------------------------------------------

  p.onActivate = () => {
    if (!sim) return;
    if (mode === 'ambient' && phase === 'hold') armHold();
    if (mode === 'garden') armTick();
  };

  p.onDeactivate = () => {
    holdArmed = false;
    tickArmed = false;
    erasing = null;
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    if (!sim) return;
    p.cancelScheduled();
    holdArmed = false;
    tickArmed = false;
    z = 0;
    zoom = null;
    allocate();
    startAmbient(species);
  };
}
