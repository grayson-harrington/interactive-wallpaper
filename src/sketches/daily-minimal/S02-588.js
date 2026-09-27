// S02-588 black hole
// 240 fine white rays fanning out from a black disc, cut off by a square. Every
// 30s the disc drifts once round the square's center and back to rest where it
// started, the rays re-aiming from it as it goes (each orbit the other way
// round from the last). With someone at the page, the disc eases after the
// cursor, kept inside the square, and drifts home when they leave.
import { dmSketch } from './harness.js';

const bg = 22;
const ink = 241;

// Geometry, measured: rays every 1.5 degrees (one at 0) from the disc center,
// clipped to the square x 270-733, y 261-723. The disc has a thin bright rim.
const SQ = [270, 261, 464, 463];
const OX = 437.5;
const OY = 571.4;
const DISC = 82;
const RAYS = 240;
const RAY_W = 1.3;
const RIM = 82.8;
const RIM_W = 1.2;
const LONG = 1200; // rays reach past any corner

// Room for the disc center: the disc stays inside the square.
const MIN_X = SQ[0] + DISC;
const MAX_X = SQ[0] + SQ[2] - DISC;
const MIN_Y = SQ[1] + DISC;
const MAX_Y = SQ[1] + SQ[3] - DISC;

// Ambient orbit: once round the square's center, through the disc's home,
// over MOVE seconds, then rest HOLD seconds. It stays inside the square.
const MOVE = 24;
const HOLD = 6;
const PX = SQ[0] + SQ[2] / 2;
const PY = SQ[1] + SQ[3] / 2;
const ORBIT = Math.hypot(OX - PX, OY - PY);
const START = Math.atan2(OY - PY, OX - PX);

const FOLLOW = 2.5; // per second
const TAU = Math.PI * 2;
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function draw(p, x, y) {
  const ctx = p.drawingContext;
  const [sx, sy, sw, sh] = SQ;
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineWidth = RAY_W;
  ctx.beginPath();
  for (let i = 0; i < RAYS; i++) {
    const a = (i * TAU) / RAYS;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.moveTo(x + c * (DISC - 2), y + s * (DISC - 2));
    ctx.lineTo(x + c * LONG, y + s * LONG);
  }
  ctx.stroke();

  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  ctx.beginPath();
  ctx.arc(x, y, DISC, 0, TAU);
  ctx.fill();
  ctx.lineWidth = RIM_W;
  ctx.beginPath();
  ctx.arc(x, y, RIM, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: SQ,
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.mode = 'hold'; // hold | move | live | home
    S.u = 0;
    S.side = 1;
    S.x = OX;
    S.y = OY;
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    const follow = Math.min(1, FOLLOW * dt);
    const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);
    if (S.live && mouseMoved) S.mode = 'live';

    let moving = true;
    if (S.mode === 'move') {
      S.u += dt / MOVE;
      if (S.u >= 1) {
        S.u = 0;
        S.side = -S.side;
        S.mode = 'hold';
      }
      const a = START + S.side * TAU * smoother(S.u);
      S.x = PX + ORBIT * Math.cos(a);
      S.y = PY + ORBIT * Math.sin(a);
    } else if (S.mode === 'live') {
      if (!S.live) S.mode = 'home';
      const tx = clamp(S.mouseX, MIN_X, MAX_X);
      const ty = clamp(S.mouseY, MIN_Y, MAX_Y);
      S.x += (tx - S.x) * follow;
      S.y += (ty - S.y) * follow;
      moving = mouseMoved || Math.hypot(tx - S.x, ty - S.y) > 0.05;
    } else if (S.mode === 'home') {
      S.x += (OX - S.x) * follow;
      S.y += (OY - S.y) * follow;
      if (Math.hypot(OX - S.x, OY - S.y) < 0.05) {
        S.x = OX;
        S.y = OY;
        S.mode = 'hold';
      }
    }
    if (S.mode === 'hold') moving = false;

    draw(p, S.x, S.y);

    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
    if (!moving) {
      // at rest, or live with the disc caught up: wake later to start the
      // next loop or notice the page has gone idle
      if (!S.armed) {
        S.armed = true;
        p.schedule(() => {
          S.armed = false;
          if (S.mode === 'hold') {
            S.mode = 'move';
            S.u = 0;
          }
          p.loop();
        }, HOLD * 1000);
      }
      p.noLoop();
    }
  },
  onActivate(p, S) {
    S.armed = false;
  },
});
