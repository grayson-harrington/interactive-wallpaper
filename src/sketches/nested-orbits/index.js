// Nested Orbits
//
// A ball covered in nested circles hangs inside a much larger sphere whose
// inner wall is covered the same way. Every circle spins about its own centre
// and carries the circles inside it along, so the pattern swirls at every
// scale; smaller circles turn faster, capped at a turn every 4 s.
// Inspired by tzador's "Circles on spheres" (webvibes.tzador.com); this is an
// independent implementation with its own layout, palettes and pacing.
//
// Ambient: the ball turns slowly about a wandering axis, the wall follows it
// with a slow counter-drift, and about every 10 minutes a new layout and
// palette cross-fade in. 20 fps; the ball renders at the screen's density
// (up to 2x) and the wall, dim and behind it, at half of CSS resolution.
// Interactive (30 fps): drag to roll the ball like a trackball, fling it for
// momentum that settles back into the idle drift; click or R for a new layout.

import { generateLayout, updatePose } from './layout.js';
import { createRenderer, EYE, FOCAL } from './renderer.js';
import { PALETTES } from './palettes.js';

const BALL = { count: 7000, thMin: 0.009, thMax: 0.62 }; // ~5.4k circles placed
const WALL = { count: 5500, thMin: 0.01, thMax: 0.4 }; // ~4.2k
const IDLE_SPIN = 0.03; // rad/s
const WALL_DRIFT = -0.01; // rad/s, the wall's own turn on top of following the ball
const SETTLE = 0.7; // s, time constant for a fling to relax back to the idle spin
const MAX_FLING = 6; // rad/s
const FADE_MS = 1500;
const RESEED_MS = 10 * 60_000;
const AMBIENT_FPS = 20;
const INTERACTIVE_FPS = 30;
const CLICK_PX = 5;
const CLICK_MS = 400;

// ---- row-major 3x3 rotations, written into preallocated arrays --------------

function rotInto(out, x, y, z, a) {
  const c = Math.cos(a), s = Math.sin(a), k = 1 - c;
  out[0] = k * x * x + c; out[1] = k * x * y - s * z; out[2] = k * x * z + s * y;
  out[3] = k * x * y + s * z; out[4] = k * y * y + c; out[5] = k * y * z - s * x;
  out[6] = k * x * z - s * y; out[7] = k * y * z + s * x; out[8] = k * z * z + c;
}

const scratch = new Float64Array(9);
function mulInto(out, A, B) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      scratch[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    }
  }
  out.set(scratch);
}

// Keeps repeated small rotations from drifting away from a pure rotation.
function orthonormalize(m) {
  let l = Math.hypot(m[0], m[1], m[2]);
  m[0] /= l; m[1] /= l; m[2] /= l;
  const d = m[0] * m[3] + m[1] * m[4] + m[2] * m[5];
  m[3] -= d * m[0]; m[4] -= d * m[1]; m[5] -= d * m[2];
  l = Math.hypot(m[3], m[4], m[5]);
  m[3] /= l; m[4] /= l; m[5] /= l;
  m[6] = m[1] * m[5] - m[2] * m[4];
  m[7] = m[2] * m[3] - m[0] * m[5];
  m[8] = m[0] * m[4] - m[1] * m[3];
}

export default function nestedOrbits(p) {
  let R = null;
  let ball = null, wall = null;
  let palette = -1;
  let t = 0, fps = 0;
  let fadeStart = -Infinity;
  let reseedPending = false;

  const rot = new Float64Array(9); // ball: sphere frame -> world
  const wallBase = new Float64Array(9);
  const wallRot = new Float64Array(9);
  const step = new Float64Array(9);
  const omega = new Float64Array(3); // ball's angular velocity (world), rad/s
  const phase = [Math.random() * 100, Math.random() * 100];

  let drag = null; // { x, y, t0, moved, prevT }
  const prev = new Float64Array(3);
  const cur = new Float64Array(3);

  function newLayouts() {
    let k;
    do k = Math.floor(Math.random() * PALETTES.length);
    while (k === palette && PALETTES.length > 1);
    palette = k;
    ball = generateLayout(BALL, PALETTES[k].ball);
    wall = generateLayout(WALL, PALETTES[k].wall);
    updatePose(ball, t);
    updatePose(wall, t);
    R.setLayout('ball', ball);
    R.setLayout('wall', wall);
  }

  function armReseed() {
    p.schedule(() => {
      if (!p.interactive()) reseedPending = true;
      armReseed();
    }, RESEED_MS);
  }

  function setFps() {
    const want = p.interactive() ? INTERACTIVE_FPS : AMBIENT_FPS;
    if (want !== fps) p.frameRate((fps = want));
  }

  // Idle spin about an axis that wanders over several minutes; after a fling
  // the velocity relaxes back toward it.
  function spin(dt) {
    if (drag) return; // the pointer sets the rotation directly
    let ax = 0.8 * Math.sin(0.011 * t + phase[0]);
    let ay = 1;
    let az = 0.8 * Math.sin(0.0083 * t + phase[1]);
    const l = Math.hypot(ax, ay, az);
    ax /= l; ay /= l; az /= l;
    const k = 1 - Math.exp(-dt / SETTLE);
    omega[0] += (ax * IDLE_SPIN - omega[0]) * k;
    omega[1] += (ay * IDLE_SPIN - omega[1]) * k;
    omega[2] += (az * IDLE_SPIN - omega[2]) * k;
    const s = Math.hypot(omega[0], omega[1], omega[2]);
    if (s < 1e-9) return;
    rotInto(step, omega[0] / s, omega[1] / s, omega[2] / s, s * dt);
    mulInto(rot, step, rot);
    orthonormalize(rot);
  }

  // The ball point under the pointer, in world space (same camera as the
  // shader). A miss maps to the nearest silhouette point so drags stay smooth.
  function surfacePoint(e, out) {
    const r = p.canvas.getBoundingClientRect();
    const m = Math.min(r.width, r.height);
    const ux = (e.clientX - r.left - r.width / 2) / m;
    const uy = -(e.clientY - r.top - r.height / 2) / m;
    const l = Math.hypot(ux, uy, FOCAL);
    const dx = ux / l, dy = uy / l, dz = -FOCAL / l;
    const b = EYE * dz;
    const h = b * b - (EYE * EYE - 1);
    const d = h > 0 ? -b - Math.sqrt(h) : -b;
    const x = d * dx, y = d * dy, z = EYE + d * dz;
    const n = Math.hypot(x, y, z);
    out[0] = x / n; out[1] = y / n; out[2] = z / n;
  }

  function onDown(e) {
    drag = { x: e.clientX, y: e.clientY, t0: performance.now(), moved: false, prevT: performance.now() };
    surfacePoint(e, prev);
    omega.fill(0);
    p.canvas.setPointerCapture(e.pointerId);
  }

  function onMove(e) {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > CLICK_PX) drag.moved = true;
    surfacePoint(e, cur);
    const now = performance.now();
    // rotate so the grabbed point lands exactly under the pointer
    const x = prev[1] * cur[2] - prev[2] * cur[1];
    const y = prev[2] * cur[0] - prev[0] * cur[2];
    const z = prev[0] * cur[1] - prev[1] * cur[0];
    const s = Math.hypot(x, y, z);
    if (s > 1e-9) {
      const ang = Math.atan2(s, prev[0] * cur[0] + prev[1] * cur[1] + prev[2] * cur[2]);
      rotInto(step, x / s, y / s, z / s, ang);
      mulInto(rot, step, rot);
      orthonormalize(rot);
      // remembered for the fling on release
      const v = Math.min(MAX_FLING, ang / (Math.max(1, now - drag.prevT) / 1000));
      omega[0] = 0.5 * omega[0] + 0.5 * (x / s) * v;
      omega[1] = 0.5 * omega[1] + 0.5 * (y / s) * v;
      omega[2] = 0.5 * omega[2] + 0.5 * (z / s) * v;
    }
    prev.set(cur);
    drag.prevT = now;
  }

  function onUp() {
    if (!drag) return;
    const now = performance.now();
    if (!drag.moved && now - drag.t0 < CLICK_MS) reseedPending = true;
    else if (now - drag.prevT > 120) omega.fill(0); // held still before letting go: no fling
    drag = null;
  }

  p.setup = () => {
    p.pixelDensity(Math.min(2, window.devicePixelRatio || 1)); // keeps the ball crisp
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    // All drawing is raw WebGL2 on this context; p5 only runs the loop and input.
    p.setAttributes({
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    const gl = p.drawingContext;
    R = createRenderer(gl);
    R.resize(gl.drawingBufferWidth, gl.drawingBufferHeight, p.pixelDensity());

    rotInto(rot, 1, 0, 0, 0.25); // tipped a little toward the viewer
    rotInto(wallBase, 0.6, 0, 0.8, 1.1);
    newLayouts();
    setFps();
    armReseed();

    p.canvas.addEventListener('pointerdown', onDown);
    p.canvas.addEventListener('pointermove', onMove);
    p.canvas.addEventListener('pointerup', onUp);
    p.canvas.addEventListener('pointercancel', onUp);
  };

  p.draw = () => {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    t += dt;
    setFps();
    spin(dt);

    updatePose(ball, t);
    updatePose(wall, t);
    R.uploadPose('ball');
    R.uploadPose('wall');
    // the wall turns with the ball (dragging feels like orbiting) plus its own slow drift
    rotInto(step, 0, 1, 0, WALL_DRIFT * t);
    mulInto(wallRot, wallBase, step);
    mulInto(wallRot, rot, wallRot);

    const u = 1 - (performance.now() - fadeStart) / FADE_MS;
    R.draw(rot, wallRot, u > 0 ? u * u * (3 - 2 * u) : 0);

    if (reseedPending) {
      reseedPending = false;
      R.snapshot();
      newLayouts();
      fadeStart = performance.now();
    }
  };

  p.keyPressed = () => {
    if (p.key === 'r' || p.key === 'R') reseedPending = true;
  };

  p.onActivate = () => armReseed();

  p.onDeactivate = () => {
    drag = null;
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    const gl = p.drawingContext;
    R.resize(gl.drawingBufferWidth, gl.drawingBufferHeight, p.pixelDensity());
    fadeStart = -Infinity; // the frozen frame was the old size
  };
}
