// S02-481 golden spiral
// A golden rectangle of paper squares, each cut off the remainder in turn,
// spiralling clockwise into a small uncut core. Every 20s it takes one step
// inward: the tiling zooms by phi and turns a quarter around the spiral's
// center until the next square lands exactly where the big one was, with a new
// cut fading in at the core. The frame stays put and clips it. With someone at
// the page, the square under the cursor lifts: brighter, its gutter widened.
import { dmSketch } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 22;
const PHI = (1 + Math.sqrt(5)) / 2;

// Geometry, measured: square sides 375, 232, 143, 88, 55, 34, 21 between
// gutter centerlines, 4px gutters, an uncut 13x21 core, centered at
// (640.5, 640). Tiles are drawn inset by half a gutter, so the visible frame
// is 603x371.
const H = 375;
const W = H * PHI;
const X0 = 640.5 - W / 2;
const Y0 = 640 - H / 2;
const GUTTER = 4;
const FRAME = [X0 + GUTTER / 2, Y0 + GUTTER / 2, W - GUTTER, H - GUTTER];

// Levels: square k is cut off the remainder rectangle R_k on side DIRS[k % 4],
// leaving R_(k+1). Negative levels extend the spiral outward so the frame
// stays covered while the tiling turns.
const DIRS = ['left', 'top', 'right', 'bottom'];
const OUTER = 4; // levels -OUTER..-1
const INNER = 14; // levels 0..INNER-1
const LEVELS = OUTER + INNER;
// A cut fades in as its square grows from 13.5 to 20px on screen; the rest
// pose shows the 21px square cut and the 13px one uncut, like the original.
const FADE = [13.5, 20];

// Timing, in seconds.
const HOLD = 14;
const MOVE = 6;

// Hover.
const LIFT_IN = 6; // per second
const LIFT_OUT = 3;
const LIFT_GUTTER = 3; // extra px of gutter at full lift
const LIFT_GLOW = 0.3; // white overlay alpha at full lift

const dirOf = (k) => DIRS[((k % 4) + 4) % 4];
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

// { R: [x, y, w, h] remainder, S: square, cut: [x0, y0, x1, y1] } per level.
function buildLevels() {
  const L = new Array(LEVELS);
  let R = [X0, Y0, W, H];
  for (let k = 0; k < INNER; k++) {
    const [x, y, w, h] = R;
    let S;
    let cut;
    let next;
    switch (dirOf(k)) {
      case 'left':
        S = [x, y, h, h];
        cut = [x + h, y, x + h, y + h];
        next = [x + h, y, w - h, h];
        break;
      case 'top':
        S = [x, y, w, w];
        cut = [x, y + w, x + w, y + w];
        next = [x, y + w, w, h - w];
        break;
      case 'right':
        S = [x + w - h, y, h, h];
        cut = [x + w - h, y, x + w - h, y + h];
        next = [x, y, w - h, h];
        break;
      default:
        S = [x, y + h - w, w, w];
        cut = [x, y + h - w, x + w, y + h - w];
        next = [x, y, w, h - w];
    }
    L[OUTER + k] = { R, S, cut, side: S[2] };
    R = next;
  }
  // outward: R_(k-1) is R_k plus a square on side DIRS[k-1]
  R = [X0, Y0, W, H];
  for (let k = -1; k >= -OUTER; k--) {
    const [x, y, w, h] = R;
    let S;
    let cut;
    switch (dirOf(k)) {
      case 'left':
        S = [x - h, y, h, h];
        R = [x - h, y, w + h, h];
        cut = [x, y, x, y + h];
        break;
      case 'top':
        S = [x, y - w, w, w];
        R = [x, y - w, w, h + w];
        cut = [x, y, x + w, y];
        break;
      case 'right':
        S = [x + w, y, h, h];
        R = [x, y, w + h, h];
        cut = [x + w, y, x + w, y + h];
        break;
      default:
        S = [x, y + h, w, w];
        R = [x, y, w, h + w];
        cut = [x, y + h, x + w, y + h];
    }
    L[OUTER + k] = { R, S, cut, side: S[2] };
  }
  return L;
}

const LV = buildLevels();

// The spiral's center: the fixed point of the step that carries square 1's
// center p onto square 0's center q, q = C + M (p - C) with M = phi * R(-90).
const C = (() => {
  const center = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
  const [px, py] = center(LV[OUTER + 1].S);
  const [qx, qy] = center(LV[OUTER].S);
  // (I - M) C = q - M p, with M = [[0, phi], [-phi, 0]]
  const bx = qx - PHI * py;
  const by = qy + PHI * px;
  const det = 1 + PHI * PHI;
  return [(bx + PHI * by) / det, (by - PHI * bx) / det];
})();

// One step maps level k+1 onto level k: scale by phi and turn a quarter
// counter-clockwise on screen about C. `t` in [0, 1] is the progress.
function pose(t) {
  return { sc: PHI ** t, a: (-Math.PI / 2) * t };
}

function toWorld(S, x, y) {
  const c = Math.cos(-S.pose.a);
  const s = Math.sin(-S.pose.a);
  const dx = (x - C[0]) / S.pose.sc;
  const dy = (y - C[1]) / S.pose.sc;
  return [C[0] + c * dx - s * dy, C[1] + s * dx + c * dy];
}

const inside = (r, x, y) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
const cutAlpha = (i, sc) => clamp01((LV[i].side * sc - FADE[0]) / (FADE[1] - FADE[0]));

// The tile under world point (x, y): a square whose cut shows, or the
// remainder where cutting stops. Returns its level index or -1.
function tileAt(S, x, y) {
  for (let i = 0; i < LEVELS; i++) {
    const lv = LV[i];
    if (!inside(lv.R, x, y)) continue;
    if (cutAlpha(i, S.pose.sc) < 0.5) return i;
    if (inside(lv.S, x, y)) return i;
  }
  return -1;
}

function tileRect(S, i) {
  return cutAlpha(i, S.pose.sc) < 0.5 ? LV[i].R : LV[i].S;
}

function paperTexture() {
  const [fx, fy, fw, fh] = FRAME;
  const w = Math.ceil(fw) + 4;
  const h = Math.ceil(fh) + 4;
  const tex = dotPaperCanvas(w, h, { base: 242, gray: [185, 255], alpha: [60, 140], density: 1 });
  const flecks = paperCanvas(w, h, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 120),
    speckAlpha: [50, 170],
    speckGray: [20, 110],
    speckSize: [0.8, 2.2],
  });
  tex.getContext('2d').drawImage(flecks, 0, 0);
  return { tex, x: Math.floor(fx) - 2, y: Math.floor(fy) - 2 };
}

function draw(p, S) {
  const ctx = p.drawingContext;
  const [fx, fy, fw, fh] = FRAME;
  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fw, fh);
  ctx.clip();
  // the paper stays put; the cuts move across it
  ctx.drawImage(S.paper.tex, S.paper.x, S.paper.y);

  const { sc, a } = S.pose;
  ctx.translate(C[0], C[1]);
  ctx.rotate(a);
  ctx.scale(sc, sc);
  ctx.translate(-C[0], -C[1]);

  const lw = GUTTER / sc;
  const ext = lw / 2;
  ctx.lineWidth = lw;
  ctx.lineCap = 'butt';
  for (let i = 0; i < LEVELS; i++) {
    const alpha = cutAlpha(i, sc);
    if (alpha <= 0) break;
    const [x0, y0, x1, y1] = LV[i].cut;
    const vertical = x0 === x1;
    ctx.strokeStyle = `rgba(${bg},${bg},${bg},${alpha})`;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(x0, y0 - ext);
      ctx.lineTo(x1, y1 + ext);
    } else {
      ctx.moveTo(x0 - ext, y0);
      ctx.lineTo(x1 + ext, y1);
    }
    ctx.stroke();
  }

  for (let i = 0; i < LEVELS; i++) {
    const l = S.lift[i];
    if (l < 0.002) continue;
    const e = smoother(l);
    const [x, y, w, h] = tileRect(S, i);
    const g = GUTTER / 2 / sc;
    ctx.fillStyle = `rgba(255,255,255,${LIFT_GLOW * e})`;
    ctx.fillRect(x + g, y + g, w - 2 * g, h - 2 * g);
    const band = (LIFT_GUTTER * e) / sc;
    ctx.strokeStyle = `rgb(${bg},${bg},${bg})`;
    ctx.lineWidth = band;
    ctx.strokeRect(x + g + band / 2, y + g + band / 2, w - 2 * g - band, h - 2 * g - band);
  }
  ctx.restore();
}

// Ease every tile's lift toward hovered-or-not. Returns true while moving.
function updateLift(S, dt) {
  let hovered = -1;
  if (S.live) {
    const [x, y] = toWorld(S, S.mouseX, S.mouseY);
    if (inside(FRAME, S.mouseX, S.mouseY)) hovered = tileAt(S, x, y);
  }
  let moving = false;
  for (let i = 0; i < LEVELS; i++) {
    const target = i === hovered ? 1 : 0;
    const l = S.lift[i];
    if (l === target) continue;
    const step = (target > l ? LIFT_IN : LIFT_OUT) * dt;
    S.lift[i] = target > l ? Math.min(target, l + step) : Math.max(target, l - step);
    moving = true;
  }
  return moving;
}

function startMove(p, S) {
  S.phase = 'move';
  S.u = 0;
  S.armed = false;
  p.loop();
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: [X0, Y0, W, H], // the golden rectangle
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.paper = paperTexture();
    S.lift = new Float32Array(LEVELS);
    S.pose = pose(0);
    S.phase = 'hold';
    S.u = 0;
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    // hover wakes a settled frame
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;

    if (S.phase === 'move') {
      S.u += dt / MOVE;
      if (S.u >= 1) {
        // level k+1 now sits exactly on level k: renumber and rest
        S.u = 0;
        S.phase = 'hold';
        S.lift.copyWithin(0, 1);
        S.lift[LEVELS - 1] = 0;
      }
    }
    S.pose = pose(S.phase === 'move' ? smoother(S.u) : 0);
    const lifting = updateLift(S, dt);
    draw(p, S);

    if (S.phase === 'hold') {
      if (!S.armed) {
        S.armed = true;
        p.schedule(() => startMove(p, S), HOLD * 1000);
      }
      const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);
      if (!lifting && !mouseMoved) p.noLoop();
    }
    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
  },
  onActivate(p, S) {
    S.armed = false; // a hold timer was cancelled while hidden; re-arm it
  },
});
