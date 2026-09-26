// S02-498 gravity well
// A wireframe gravity well in a square: the surface z = -K/r spun around the
// throat, with rings at geometric spacing and ten spokes, seen tilted. The
// surface is split into small faces that are filled with the background and
// painted far to near, each drawing its own stretch of grid line, so nearer
// parts hide farther ones (the near wall disappears behind the lip). The rings
// drain into the throat, one ring step every few seconds; geometric spacing
// makes each step land exactly where the next ring was. The throat leans
// toward the mouse (heavily) while someone is using the page and toward a slow
// wanderer otherwise, dragging the nearby surface with it.
import { dmSketch, wanderer } from "./harness.js";

const bg = 22;
const ink = 243;
const WEIGHT = 2.6;

// The square frame (source pixels).
const F0 = 398.8;
const F1 = 880.8;
const CX = 640;

// The well and camera, fitted to the original.
const K = 1.6902; // depth: z = -K / r
const RT = 0.3901; // throat radius (the mesh starts here)
const Q = 1.153648; // ratio between neighboring rings
const TILT = 46.3235 * (Math.PI / 180);
const PERSP = -0.012617;
const ZOOM = 118.003;
const CY = 609.436;

const RINGS = 18; // rings past the throat that reach into the frame
const SUB_R = 3; // mesh rows per ring gap
const SPOKES = 10; // at multiples of 36°, so none runs up the back
const SUB_T = 6; // mesh columns per spoke gap
const COLS = SPOKES * SUB_T;
const MAX_ROWS = 1 + (RINGS + 1) * SUB_R;

const SECONDS_PER_RING = 3;

// --- mesh buffers (allocated once) ---------------------------------------------

const rowS = new Float32Array(MAX_ROWS); // ring-step coordinate: r = RT·Q^s
const rowRing = new Uint8Array(MAX_ROWS); // does a ring line run along this row
const SX = new Float32Array(MAX_ROWS * COLS);
const SY = new Float32Array(MAX_ROWS * COLS);
const ZC = new Float32Array(MAX_ROWS * COLS); // larger = nearer
const faceDepth = new Float32Array(MAX_ROWS * COLS);
const faces = [];
let nFaces = 0;
const byDepth = (a, b) => faceDepth[a] - faceDepth[b];

const COS = new Float32Array(COLS);
const SIN = new Float32Array(COLS);
for (let j = 0; j < COLS; j++) {
  COS[j] = Math.cos((j / COLS) * 2 * Math.PI);
  SIN[j] = Math.sin((j / COLS) * 2 * Math.PI);
}
const cosT = Math.cos(TILT);
const sinT = Math.sin(TILT);

// Rows for this drain phase: ring lines at s = k + u, with SUB_R - 1 rows
// between neighbors, starting from the throat at s = 0.
function buildRows(phase) {
  const u = (1 - phase) % 1;
  let n = 0;
  rowS[n] = 0;
  rowRing[n++] = u === 0 ? 1 : 0;
  let prev = 0;
  for (let k = 0; k <= RINGS; k++) {
    const s = k + u;
    if (s <= 0) continue;
    for (let j = 1; j < SUB_R; j++) {
      rowS[n] = prev + ((s - prev) * j) / SUB_R;
      rowRing[n++] = 0;
    }
    rowS[n] = s;
    rowRing[n++] = 1;
    prev = s;
  }
  return n;
}

// Project every mesh vertex. The throat leans by (ox, oy) in the plane,
// fading out over the first several rings.
function project(rows, ox, oy) {
  for (let i = 0; i < rows; i++) {
    const s = rowS[i];
    const r = RT * Math.pow(Q, s);
    const z = -K / r;
    const w = Math.exp(-(s / 6) * (s / 6));
    for (let j = 0; j < COLS; j++) {
      const x = r * COS[j] + ox * w;
      const y = r * SIN[j] + oy * w;
      const yc = y * cosT + z * sinT;
      const zc = -y * sinT + z * cosT;
      const f = 1 / (1 - zc * PERSP);
      const k = i * COLS + j;
      SX[k] = CX + ZOOM * x * f;
      SY[k] = CY - ZOOM * yc * f;
      ZC[k] = zc;
    }
  }
}

// Faces that touch the frame, sorted far to near.
function collectFaces(rows) {
  nFaces = 0;
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < COLS; j++) {
      const a = i * COLS + j;
      const b = i * COLS + ((j + 1) % COLS);
      const c = b + COLS;
      const d = a + COLS;
      const x0 = Math.min(SX[a], SX[b], SX[c], SX[d]);
      const x1 = Math.max(SX[a], SX[b], SX[c], SX[d]);
      const y0 = Math.min(SY[a], SY[b], SY[c], SY[d]);
      const y1 = Math.max(SY[a], SY[b], SY[c], SY[d]);
      if (x1 < F0 || x0 > F1 || y1 < F0 || y0 > F1) continue;
      faceDepth[a] = ZC[a] + ZC[b] + ZC[c] + ZC[d];
      faces[nFaces++] = a;
    }
  }
  faces.length = nFaces;
  faces.sort(byDepth);
}

// Paint the faces far to near into ctx (source coordinates), each filled with
// the background and then drawing its own stretch of grid line.
function paintMesh(ctx) {
  ctx.lineCap = "round";
  ctx.lineWidth = WEIGHT;
  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  for (let n = 0; n < nFaces; n++) {
    const a = faces[n];
    const i = (a / COLS) | 0;
    const j = a - i * COLS;
    const j2 = (j + 1) % COLS;
    const b = i * COLS + j2;
    const c = b + COLS;
    const d = a + COLS;
    ctx.beginPath();
    ctx.moveTo(SX[a], SY[a]);
    ctx.lineTo(SX[b], SY[b]);
    ctx.lineTo(SX[c], SY[c]);
    ctx.lineTo(SX[d], SY[d]);
    ctx.closePath();
    ctx.fill();

    const ringIn = rowRing[i];
    const ringOut = rowRing[i + 1];
    const spokeA = j % SUB_T === 0;
    const spokeB = j2 % SUB_T === 0;
    if (!(ringIn || ringOut || spokeA || spokeB)) continue;
    ctx.beginPath();
    if (ringIn) {
      ctx.moveTo(SX[a], SY[a]);
      ctx.lineTo(SX[b], SY[b]);
    }
    if (ringOut) {
      ctx.moveTo(SX[d], SY[d]);
      ctx.lineTo(SX[c], SY[c]);
    }
    if (spokeA) {
      ctx.moveTo(SX[a], SY[a]);
      ctx.lineTo(SX[d], SY[d]);
    }
    if (spokeB) {
      ctx.moveTo(SX[b], SY[b]);
      ctx.lineTo(SX[c], SY[c]);
    }
    ctx.stroke();
  }
}

// Below native size (e.g. the thumbnail) the thin per-face line pieces break
// up, so the frame is painted at native size offscreen and halved down to the
// screen instead. Canvases are made on first use and reused.
const SIDE = Math.ceil(F1 - F0);
const offscreen = [];
function layer(k, size) {
  if (!offscreen[k]) offscreen[k] = document.createElement("canvas");
  const c = offscreen[k];
  if (c.width !== size) c.width = c.height = size;
  return c;
}

function drawWell(p, phase, ox, oy) {
  const ctx = p.drawingContext;
  const rows = buildRows(phase);
  project(rows, ox, oy);
  collectFaces(rows);

  const t = ctx.getTransform();
  const scale = Math.hypot(t.a, t.b);
  ctx.save();
  ctx.beginPath();
  ctx.rect(F0, F0, F1 - F0, F1 - F0);
  ctx.clip();
  if (scale >= 0.9) {
    paintMesh(ctx);
  } else {
    let src = layer(0, SIDE);
    const oc = src.getContext("2d");
    oc.setTransform(1, 0, 0, 1, -F0, -F0);
    oc.fillStyle = `rgb(${bg},${bg},${bg})`;
    oc.fillRect(F0, F0, SIDE, SIDE);
    paintMesh(oc);
    const target = SIDE * scale;
    for (let k = 1; src.width / 2 >= target; k++) {
      const next = layer(k, Math.ceil(src.width / 2));
      const nc = next.getContext("2d");
      nc.imageSmoothingQuality = "high";
      nc.drawImage(src, 0, 0, next.width, next.height);
      src = next;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, F0, F0, SIDE, SIDE);
  }
  ctx.restore();

  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineWidth = WEIGHT;
  ctx.strokeRect(F0, F0, F1 - F0, F1 - F0);
}

// --- motion --------------------------------------------------------------------

// Throat position at rest (screen), and how far it may lean: an ellipse,
// shorter downward so the front band stays in view.
const REST = [CX, 800];
const REACH_X = 100;
const REACH_UP = 90;
const REACH_DOWN = 30;
const clampOffset = (x, y) => {
  const ry = y < 0 ? REACH_UP : REACH_DOWN;
  const d = Math.hypot(x / REACH_X, y / ry);
  return d > 1 ? [x / d, y / d] : [x, y];
};

// Ambient: rest on the original, drift away with the wanderer, come back.
const HOLD = 30;
const LEAVE = 6;
const ROAM = 40;
const RETURN = 6;
const smooth = (t) => t * t * (3 - 2 * t);

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: [F0, F0, F1 - F0, F1 - F0], // the frame
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.wander = wanderer(p, REST[0], REST[1], REACH_X * 1.4, 0.0015);
    S.phase = 0;
    S.off = [0, 0];
    S.state = "hold";
    S.t = 0;
    S.from = [0, 0];
    S.wasLive = false;
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    S.phase = (S.phase + dt / SECONDS_PER_RING) % 1;

    if (S.live) {
      // heavy follow: ease toward the cursor over about a second
      const [tx, ty] = clampOffset(S.mouseX - REST[0], S.mouseY - REST[1]);
      const ease = 1 - Math.exp(-dt * 2.5);
      S.off[0] += (tx - S.off[0]) * ease;
      S.off[1] += (ty - S.off[1]) * ease;
    } else {
      if (S.wasLive) [S.state, S.t, S.from] = ["return", 0, [...S.off]];
      S.t += dt;
      const w = S.wander();
      const target = clampOffset(w[0] - REST[0], w[1] - REST[1]);
      if (S.state === "hold") {
        S.off = [0, 0];
        if (S.t >= HOLD) [S.state, S.t] = ["leave", 0];
      } else if (S.state === "leave") {
        const k = smooth(Math.min(S.t / LEAVE, 1));
        S.off = [target[0] * k, target[1] * k];
        if (S.t >= LEAVE) [S.state, S.t] = ["roam", 0];
      } else if (S.state === "roam") {
        S.off = target;
        if (S.t >= ROAM) [S.state, S.t, S.from] = ["return", 0, [...S.off]];
      } else {
        const k = smooth(Math.min(S.t / RETURN, 1));
        S.off = [S.from[0] * (1 - k), S.from[1] * (1 - k)];
        if (S.t >= RETURN) [S.state, S.t] = ["hold", 0];
      }
    }
    S.wasLive = S.live;

    // screen offset to a lean in the plane (screen up = farther away)
    drawWell(p, S.phase, S.off[0] / ZOOM, -S.off[1] / (ZOOM * cosT));
  },
});
