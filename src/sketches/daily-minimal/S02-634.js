// S02-634 magnetic field
// A white disc in a grainy charcoal square, wrapped in field lines: nested
// ellipses that all touch the field axis at the disc's center, a matching set
// on each side. After a 15s rest the field breathes out one step over 8s:
// each loop swells into the next one's place, a new loop rises out of the
// disc and the outermost fades at the square's edge, landing back on the
// original. With
// someone at the page, the axis turns to point at the cursor, and eases back
// to 45 degrees when they leave.
import { dmSketch } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 239;
const ink = 44;
const lineGray = 236;

// Geometry, measured: square 688px at (376, 347), disc r=60 at (842, 813.5),
// axis at 45 degrees. Each loop is an ellipse through the disc center, tangent
// to the axis there: semi-axis A across the axis, Q*A along it, so it reaches
// L = 2A out from the center. The same loops on both sides.
const SQ = [376, 347, 688, 688];
const CX = 842;
const CY = 813.5;
const DISC = 60;
const AXIS = Math.PI / 4;
const Q = 1.51;
const LINE = 1.3;
// Loop sizes L, fitted to the original. L_0 sits inside the disc and L_11 is
// where the outermost loop has faded away.
const L = [33, 121.5, 210, 302.5, 394.5, 468, 526.5, 573, 604, 626.5, 640, 650];
const LAST = L.length - 1;

// Timing, in seconds.
const HOLD = 15;
const MOVE = 8;
const HOME = 6; // the axis easing back after someone leaves

// Axis easing toward the cursor, per second.
const TURN = 2.5;

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Loop size at a fractional index, linear between the fitted values.
function sizeAt(u) {
  const i = Math.min(Math.floor(u), LAST - 1);
  return L[i] + (L[i + 1] - L[i]) * (u - i);
}

function squareCanvas() {
  const [, , w, h] = SQ;
  const tex = dotPaperCanvas(w, h, { base: ink, gray: [0, 120], alpha: [40, 110], density: 1 });
  const flecks = paperCanvas(w, h, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 260),
    speckAlpha: [70, 200],
    speckGray: [200, 255],
    speckSize: [0.8, 2.2],
  });
  tex.getContext('2d').drawImage(flecks, 0, 0);
  return tex;
}

function draw(p, S, shift, axis) {
  const ctx = p.drawingContext;
  const [x, y, w, h] = SQ;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(S.square, x, y);

  ctx.lineWidth = LINE;
  const ux = Math.cos(axis);
  const uy = -Math.sin(axis);
  for (let k = 0; k < LAST; k++) {
    const u = k + shift;
    // the loop leaving the last slot fades out
    const alpha = u > LAST - 1 ? 1 - (u - (LAST - 1)) : 1;
    if (alpha <= 0) continue;
    const A = sizeAt(u) / 2;
    ctx.strokeStyle = `rgba(${lineGray},${lineGray},${lineGray},${alpha})`;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      const nx = -uy * side;
      const ny = ux * side;
      const ex = CX + A * nx;
      const ey = CY + A * ny;
      ctx.moveTo(ex + A * nx, ey + A * ny);
      ctx.ellipse(ex, ey, A, Q * A, Math.atan2(ny, nx), 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  ctx.beginPath();
  ctx.arc(CX, CY, DISC, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Nearest equivalent of `target` to `from`; the axis has no direction.
function nearestAxis(from, target) {
  return target + Math.round((from - target) / Math.PI) * Math.PI;
}

export default dmSketch({
  ow: 1440,
  oh: 1440,
  art: SQ,
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.square = squareCanvas();
    S.axis = AXIS;
    S.phase = 'hold';
    S.u = 0;
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;

    if (S.phase === 'move') {
      S.u += dt / MOVE;
      if (S.u >= 1) {
        S.u = 0;
        S.phase = 'hold';
      }
    }

    let turning = false;
    if (S.live) {
      const target = nearestAxis(S.axis, Math.atan2(-(S.mouseY - CY), S.mouseX - CX));
      turning = Math.abs(target - S.axis) > 0.0005;
      S.axis = turning ? S.axis + (target - S.axis) * Math.min(1, TURN * dt) : target;
      S.home = null;
    } else if (S.axis !== AXIS) {
      // a timed, eased turn back to rest
      if (!S.home) S.home = { from: S.axis, to: nearestAxis(S.axis, AXIS), t: 0 };
      S.home.t = Math.min(1, S.home.t + dt / HOME);
      S.axis = S.home.from + (S.home.to - S.home.from) * smoother(S.home.t);
      turning = S.home.t < 1;
      if (!turning) {
        S.axis = AXIS;
        S.home = null;
      }
    }

    draw(p, S, S.phase === 'move' ? smoother(S.u) : 0, S.axis);

    if (S.phase === 'hold') {
      if (!S.armed) {
        S.armed = true;
        p.schedule(() => {
          S.phase = 'move';
          S.u = 0;
          S.armed = false;
          p.loop();
        }, HOLD * 1000);
      }
      const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);
      if (!turning && !mouseMoved) p.noLoop();
    }
    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
  },
  onActivate(p, S) {
    S.armed = false;
  },
});
