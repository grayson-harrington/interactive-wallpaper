// S02-582 wandering tunnel
// A one-point perspective wireframe corridor. At rest the vanishing point sits
// on the frame's left edge, as in the original; it roams around the frame,
// returns to rest and holds, or follows the mouse while someone is using the page.
import { dmSketch, wanderer } from './harness.js';

const bg = 22;
const ink = 235;

const W = 452; // frame side
const X0 = 500 - W / 2;
const Y0 = 500 - W / 2;
const REST = [X0, Y0 + W / 2];

// Size of each depth frame relative to the mouth, measured from the original;
// the last one is the back opening.
const SCALES = [0.806, 0.654, 0.527, 0.446, 0.371, 0.317, 0.263, 0.221, 0.187, 0.158, 0.131, 0.11, 0.093];
const BACK = SCALES[SCALES.length - 1];

// Each wall's edge is divided evenly for the lines running to the back, with a
// different count per wall, as in the original (the left wall is edge-on
// there, so it mirrors the right).
const TOP = 15;
const RIGHT = 19;
const BOTTOM = 11;
const LEFT = 19;

// Ambient cycle, in seconds.
const HOLD = 5;
const LEAVE = 3;
const ROAM = 16;
const RETURN = 3;

// The n + 1 points dividing the edge from a to b into n equal parts.
function edgePoints(ax, ay, bx, by, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  return pts;
}

const MOUTH = [
  ...edgePoints(X0, Y0, X0 + W, Y0, TOP),
  ...edgePoints(X0 + W, Y0, X0 + W, Y0 + W, RIGHT),
  ...edgePoints(X0, Y0 + W, X0 + W, Y0 + W, BOTTOM),
  ...edgePoints(X0, Y0, X0, Y0 + W, LEFT),
];

const clampX = (x) => Math.min(X0 + W, Math.max(X0, x));
const clampY = (y) => Math.min(Y0 + W, Math.max(Y0, y));
const smooth = (t) => t * t * (3 - 2 * t);

function drawTunnel(p, vx, vy) {
  p.noFill();
  p.stroke(ink);
  p.strokeWeight(1.6);
  for (const [x, y] of MOUTH) p.line(x, y, vx + (x - vx) * BACK, vy + (y - vy) * BACK);
  p.rect(X0, Y0, W, W);
  for (const s of SCALES) p.rect(vx + (X0 - vx) * s, vy + (Y0 - vy) * s, W * s, W * s);
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: [X0, Y0, W, W], // the frame
  scale: 1,
  bg,
  init(p, S) {
    S.wander = wanderer(p, 500, 500, W * 0.6, 0.003);
    S.v = [...REST];
    S.state = 'hold';
    S.t = 0;
    S.wasLive = false;
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    const w = S.wander();
    const target = [clampX(w[0]), clampY(w[1])];

    if (S.live) {
      const mx = clampX(S.mouseX);
      const my = clampY(S.mouseY);
      S.v[0] += (mx - S.v[0]) * 0.12;
      S.v[1] += (my - S.v[1]) * 0.12;
    } else {
      if (S.wasLive) {
        S.state = 'return';
        S.t = 0;
        S.from = [...S.v];
      }
      S.t += dt;
      if (S.state === 'hold') {
        S.v = [...REST];
        if (S.t >= HOLD) [S.state, S.t] = ['leave', 0];
      } else if (S.state === 'leave') {
        const k = smooth(Math.min(S.t / LEAVE, 1));
        S.v = [REST[0] + (target[0] - REST[0]) * k, REST[1] + (target[1] - REST[1]) * k];
        if (S.t >= LEAVE) [S.state, S.t] = ['roam', 0];
      } else if (S.state === 'roam') {
        S.v = target;
        if (S.t >= ROAM) [S.state, S.t, S.from] = ['return', 0, [...S.v]];
      } else {
        const k = smooth(Math.min(S.t / RETURN, 1));
        S.v = [S.from[0] + (REST[0] - S.from[0]) * k, S.from[1] + (REST[1] - S.from[1]) * k];
        if (S.t >= RETURN) [S.state, S.t] = ['hold', 0];
      }
    }
    S.wasLive = S.live;

    drawTunnel(p, S.v[0], S.v[1]);
  },
});
