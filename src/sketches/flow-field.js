// Flow Field  (Processing Round 3/Noise/flow_field)
//
// A Perlin-noise vector field (one vector per 10px cell, drifting slowly over
// time) steers thousands of particles. Each particle leaves a hairline, nearly
// transparent dark stroke, and never clears the canvas, so the field's
// currents build up over the light background like pencil shading. Particles
// that leave the screen, or outlive their lifetime (adjustable in Settings),
// respawn somewhere random. Click to start a fresh sheet.
//
// "Erase marks after" (Settings) keeps a rolling window instead of drawing
// forever: strokes go into a ring of LAYERS offscreen layers, each holding a
// slice of recent frames; the oldest layer is wiped and reused, so marks
// disappear roughly N frames after they were drawn. At "never" it behaves
// like the original.
//
// Energy: the original ran 10,000 particles at 60fps. Here 4,000 particles
// at 30fps, all segments stroked in one batched path per frame. The drawing
// saturates after a while, so it starts a fresh sheet every SHEET_MINUTES.

import { createPanel, autoFade } from '../lib/panel.js';

const SCL = 10;
const NUM_PARTICLES = 4000;
const XINC = 0.07;
const YINC = 0.07;
const ZINC = 0.001;
const MAX_SPEED = 4;
const FORCE = 0.8;
const SHEET_MINUTES = 15;
const LIFE_KEY = 'iw:flow:lifetime';
const ERASE_KEY = 'iw:flow:erase';
const LAYERS = 8;
const ERASE_NEVER = 3600;

export default function flowField(p) {
  let cols;
  let rows;
  let field; // Float32Array of unit vectors [x0, y0, x1, y1, ...]
  let zoff = 0;
  let px;
  let py;
  let vx;
  let vy;
  let age;
  let started = 0;
  let lifetime = 200;
  let eraseAfter = 600;
  try {
    lifetime = Number(localStorage.getItem(LIFE_KEY)) || lifetime;
    eraseAfter = Number(localStorage.getItem(ERASE_KEY)) || eraseAfter;
  } catch {
    // storage unavailable
  }
  let layers = [];
  let current = 0;
  let layerStart = 0;
  let frame = 0;

  function makeLayers() {
    layers = Array.from({ length: LAYERS }, () => {
      const c = document.createElement('canvas');
      c.width = p.width;
      c.height = p.height;
      return c;
    });
    current = 0;
    layerStart = frame;
  }

  // the context strokes go into this frame
  function targetContext() {
    if (eraseAfter >= ERASE_NEVER) return p.drawingContext;
    const span = Math.max(1, Math.ceil(eraseAfter / LAYERS));
    if (frame - layerStart >= span) {
      current = (current + 1) % LAYERS;
      layerStart = frame;
      const c = layers[current];
      c.getContext('2d').clearRect(0, 0, c.width, c.height);
    }
    return layers[current].getContext('2d');
  }

  function respawn(i) {
    px[i] = Math.random() * p.width;
    py[i] = Math.random() * p.height;
    age[i] = Math.floor(Math.random() * lifetime); // stagger so they don't all expire together
  }

  function reset() {
    cols = Math.ceil(p.width / SCL);
    rows = Math.ceil(p.height / SCL);
    field = new Float32Array(cols * rows * 2);
    px = new Float32Array(NUM_PARTICLES);
    py = new Float32Array(NUM_PARTICLES);
    vx = new Float32Array(NUM_PARTICLES);
    vy = new Float32Array(NUM_PARTICLES);
    age = new Uint32Array(NUM_PARTICLES);
    for (let i = 0; i < NUM_PARTICLES; i++) respawn(i);
    makeLayers();
    p.background(250);
    started = performance.now();
  }

  function createField() {
    let xoff = 0;
    for (let i = 0; i < cols; i++) {
      let yoff = 0;
      for (let j = 0; j < rows; j++) {
        const angle = p.noise(xoff, yoff, zoff) * Math.PI * 2 * 4;
        const k = (i + j * cols) * 2;
        field[k] = Math.cos(angle);
        field[k + 1] = Math.sin(angle);
        yoff += YINC;
      }
      xoff += XINC;
    }
    zoff += ZINC;
  }

  p.setup = () => {
    p.pixelDensity(1); // hairlines; keeps the stroke layers small
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    const panel = createPanel(p.canvas.parentElement, { title: 'Flow Field', toggleLabel: 'Settings' });
    panel.toggle.classList.add('corner-br');
    panel.el.classList.add('corner-br');
    panel.range('Particle lifetime', { min: 10, max: 1000, step: 10, value: lifetime, format: (v) => `${v} frames (${(v / 30).toFixed(1)}s)` }, (v) => {
      lifetime = v;
      try {
        localStorage.setItem(LIFE_KEY, String(v));
      } catch {
        // storage unavailable
      }
    });
    panel.range(
      'Erase marks after',
      { min: 30, max: ERASE_NEVER, step: 30, value: eraseAfter, format: (v) => (v >= ERASE_NEVER ? 'never' : `${v} frames (${Math.round(v / 30)}s)`) },
      (v) => {
        const wasNever = eraseAfter >= ERASE_NEVER;
        eraseAfter = v;
        if (wasNever !== v >= ERASE_NEVER) reset();
        try {
          localStorage.setItem(ERASE_KEY, String(v));
        } catch {
          // storage unavailable
        }
      },
    );
    panel.buttons([
      ['New sheet', () => reset()],
      ['Hide', () => panel.hide()],
    ]);
    panel.note('Short lifetimes keep strokes short and wispy; long ones trace whole currents. Click the drawing to start over.');
    autoFade([panel.el, panel.toggle], 10_000);
    reset();
    createField();
  };

  p.draw = () => {
    if (performance.now() - started > SHEET_MINUTES * 60_000) reset();

    frame++;
    const ctx = targetContext();
    ctx.strokeStyle = 'rgba(0,0,0,0.04)'; // stroke(0, 10)
    ctx.lineWidth = 0.35; // strokeWeight(0.1), made just visible on screen
    ctx.beginPath();
    const w = p.width;
    const h = p.height;
    for (let i = 0; i < NUM_PARTICLES; i++) {
      // addForce: nearest field vector at FORCE magnitude, then speed = MAX_SPEED
      const cx = Math.min(cols - 1, Math.max(0, Math.floor(px[i] / SCL)));
      const cy = Math.min(rows - 1, Math.max(0, Math.floor(py[i] / SCL)));
      const k = (cx + cy * cols) * 2;
      let nvx = vx[i] + field[k] * FORCE;
      let nvy = vy[i] + field[k + 1] * FORCE;
      const m = Math.hypot(nvx, nvy) || 1;
      nvx = (nvx / m) * MAX_SPEED;
      nvy = (nvy / m) * MAX_SPEED;
      vx[i] = nvx;
      vy[i] = nvy;

      const ox = px[i];
      const oy = py[i];
      const nx = ox + nvx;
      const ny = oy + nvy;
      if (nx > w || nx < 0 || ny > h || ny < 0 || ++age[i] > lifetime) {
        respawn(i);
        continue;
      }
      px[i] = nx;
      py[i] = ny;
      ctx.moveTo(ox, oy);
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();
    if (ctx !== p.drawingContext) {
      p.background(250);
      for (let k = 1; k <= LAYERS; k++) p.drawingContext.drawImage(layers[(current + k) % LAYERS], 0, 0);
    }
    createField();
  };

  p.mouseClicked = () => reset();

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    reset();
  };
}
