// S02-083 offset rings
// A square cut from a target of black rings. The rings' outer edges are
// concentric about one center and their inner edges about another, a few px
// away, so every ring is thick on one side and thin on the other, as if lit
// from an angle. Every so often the light makes one slow lap: the inner
// center circles the outer one and the thick side sweeps around, back to the
// upper-left where it started. With someone at the page, the thick side
// turns away from the cursor as if it were the light, heavier the closer it
// comes, and eases home when they leave.
import { dmSketch } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 239;
const ink = 14;

// Geometry, measured. Black discs about C1, white discs about C2 painted
// over them, largest first; the radii step ~22.7px with the original's
// wobble kept, and the last two extrapolated to reach the square's corners.
const SQ = [354, 316, 572, 572];
const C1 = [639.43, 601.05];
const OUTER = [
  35.82, 57.35, 80.69, 103.59, 126.25, 149.39, 171.63, 194.26, 217.02, 240.16, 262.2, 284.97, 307.72, 330.78, 352.56,
  375.3, 398,
];
const INNER = [
  24.36, 47.06, 69.31, 91.57, 115.47, 137.73, 160.81, 183.07, 207.21, 229.54, 252.08, 274.61, 297.14, 320.23, 342.21,
  365.3, 388,
];
// C2 = C1 + offset; the rest pose puts it down-right, so rings are thick on
// the upper-left. Under ~10px the circles stay nested and the even-odd fill
// below stays exact.
const REST_DIST = Math.hypot(4.39, 4.84);
const REST_ANGLE = Math.atan2(4.84, 4.39);
const MAX_DIST = 9.5;
const MIN_DIST = 3;

// Timing, in seconds.
const HOLD = 15;
const LAP = 30;
const EASE = 3; // per second, toward the cursor-driven offset

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function inkCanvas() {
  const [, , w, h] = SQ;
  const tex = dotPaperCanvas(w, h, { base: ink, gray: [60, 170], alpha: [15, 60], density: 0.5 });
  const specks = paperCanvas(w, h, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 400),
    speckAlpha: [60, 160],
    speckSize: [0.8, 2],
  });
  tex.getContext('2d').drawImage(specks, 0, 0);
  return tex;
}

function draw(p, S) {
  const ctx = p.drawingContext;
  const [x, y, w, h] = SQ;
  const cx = C1[0] + Math.cos(S.angle) * S.dist;
  const cy = C1[1] + Math.sin(S.angle) * S.dist;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // every ring is the band between its outer and inner circle: nested, so
  // an even-odd fill of all of them is exactly the rings
  ctx.beginPath();
  for (let k = 0; k < OUTER.length; k++) {
    ctx.moveTo(C1[0] + OUTER[k], C1[1]);
    ctx.arc(C1[0], C1[1], OUTER[k], 0, Math.PI * 2);
    ctx.moveTo(cx + INNER[k], cy);
    ctx.arc(cx, cy, INNER[k], 0, Math.PI * 2);
  }
  ctx.clip('evenodd');
  ctx.drawImage(S.tex, x, y);
  ctx.restore();
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: SQ,
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.tex = inkCanvas();
    S.angle = REST_ANGLE;
    S.dist = REST_DIST;
    S.state = 'hold';
    S.t = 0;
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    let settling = false;

    if (S.live) {
      // the white center leans toward the cursor, so the thick side faces away
      const dx = S.mouseX - C1[0];
      const dy = S.mouseY - C1[1];
      const d = Math.hypot(dx, dy);
      const near = Math.min(1, Math.max(0, 1 - d / 600));
      const angle = S.angle + wrapAngle(Math.atan2(dy, dx) - S.angle);
      const dist = MIN_DIST + (MAX_DIST - MIN_DIST) * near;
      const k = Math.min(1, EASE * dt);
      S.angle += (angle - S.angle) * k;
      S.dist += (dist - S.dist) * k;
      settling = Math.abs(angle - S.angle) > 0.001 || Math.abs(dist - S.dist) > 0.01;
      S.state = 'live';
    } else if (S.state === 'live') {
      S.state = 'home';
    }

    if (S.state === 'home') {
      // ease back to the rest pose the short way round
      const k = Math.min(1, EASE * dt);
      S.angle += wrapAngle(REST_ANGLE - S.angle) * k;
      S.dist += (REST_DIST - S.dist) * k;
      if (Math.abs(wrapAngle(REST_ANGLE - S.angle)) < 0.001 && Math.abs(REST_DIST - S.dist) < 0.01) {
        S.angle = REST_ANGLE;
        S.dist = REST_DIST;
        S.state = 'hold';
      }
    } else if (S.state === 'lap') {
      S.t = Math.min(1, S.t + dt / LAP);
      S.angle = REST_ANGLE + Math.PI * 2 * smoother(S.t);
      if (S.t >= 1) {
        S.angle = REST_ANGLE;
        S.state = 'hold';
      }
    }

    draw(p, S);

    const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);
    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
    if (S.state === 'hold') {
      if (!S.armed) {
        S.armed = true;
        p.schedule(() => {
          S.armed = false;
          if (S.state !== 'hold') return;
          S.state = 'lap';
          S.t = 0;
          p.loop();
        }, HOLD * 1000);
      }
      p.noLoop();
    } else if (S.state === 'live' && !settling && !mouseMoved) {
      p.noLoop();
      // look again later: input going quiet doesn't wake the sketch
      if (!S.polling) {
        S.polling = true;
        p.schedule(() => {
          S.polling = false;
          p.loop();
        }, 5000);
      }
    }
  },
  onActivate(p, S) {
    S.armed = false;
    S.polling = false;
  },
});
