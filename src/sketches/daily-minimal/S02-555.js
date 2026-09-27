// S02-555 quarter bites
// An 11x11 grid of grainy dark squares, each with a quarter-circle bite out of
// its top-left corner that grows with the tile's distance from a source point.
// At rest the source sits on the first tile's corner, as in the original; it
// wanders around and past the grid, returns and holds, or follows the mouse
// while someone is using the page.
import { dmSketch, wanderer, restCycle } from './harness.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 239;
const ink = 41;

const N = 11;
const TILE = 35;
const PITCH = 38.9;
const SPAN = (N - 1) * PITCH + TILE;
const X0 = 500 - SPAN / 2;
const REST = [X0, X0];

// Bite radius against distance from the source in tiles, fitted to the
// original's 121 measured radii (rms error 0.6px). Capped so a sliver of each
// tile stays when the source is far away.
const R0 = 7.94;
const R1 = 2.407;
const R2 = -0.0494;
const RMAX = 34;
const DMAX = -R1 / (2 * R2);

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 5;
const ROAM = 40;
const RETURN = 5;
const FOLLOW = 3; // per second, toward the cursor

function biteRadius(d) {
  d = Math.min(d, DMAX);
  return Math.min(RMAX, R0 + R1 * d + R2 * d * d);
}

// The grid with its grain, rendered once; bites are cut on top each frame.
function gridCanvas() {
  const tex = dotPaperCanvas(SPAN, SPAN, { base: ink, gray: [110, 220], alpha: [10, 45], density: 0.4 });
  const ctx = tex.getContext('2d');
  const specks = paperCanvas(SPAN, SPAN, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: 900,
    speckAlpha: [60, 150],
    speckSize: [1, 2],
  });
  ctx.drawImage(specks, 0, 0);
  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  for (let i = 1; i < N; i++) {
    const g = i * PITCH - (PITCH - TILE);
    ctx.fillRect(g, 0, PITCH - TILE, SPAN);
    ctx.fillRect(0, g, SPAN, PITCH - TILE);
  }
  return tex;
}

function drawGrid(p, S, sx, sy) {
  const ctx = p.drawingContext;
  ctx.drawImage(S.grid, X0, X0);
  ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
  ctx.beginPath();
  for (let j = 0; j < N; j++) {
    const y = X0 + j * PITCH;
    for (let i = 0; i < N; i++) {
      const x = X0 + i * PITCH;
      const r = biteRadius(Math.hypot(x - sx, y - sy) / PITCH);
      // start in the gap so the straight edges leave no seam
      ctx.moveTo(x - 2, y - 2);
      ctx.lineTo(x + r, y - 2);
      ctx.arc(x, y, r, 0, Math.PI / 2);
      ctx.lineTo(x - 2, y + r);
      ctx.closePath();
    }
  }
  ctx.fill();
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: [X0, X0, SPAN, SPAN], // the tile grid
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.grid = gridCanvas();
    S.wander = wanderer(p, 500, 500, 380, 0.12);
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: ROAM, back: RETURN });
    S.v = [...REST];
    S.from = [...REST];
    S.wasLive = false;
  },
  frame(p, S) {
    const c = S.cycle;
    const target = S.wander();
    let still = false;

    if (S.live) {
      const k = 1 - Math.exp(-FOLLOW * S.dt);
      S.v[0] += (S.mouseX - S.v[0]) * k;
      S.v[1] += (S.mouseY - S.v[1]) * k;
      still = Math.abs(S.mouseX - S.v[0]) + Math.abs(S.mouseY - S.v[1]) < 0.05;
    } else {
      if (S.wasLive) c.toRest(RETURN);
      else c.step(S.dt);
      if (c.turned && c.phase === 'back') S.from = [...S.v];
      if (c.phase === 'hold') {
        S.v = [...REST];
        still = true;
      } else if (c.phase === 'leave') {
        S.v = [REST[0] + (target[0] - REST[0]) * c.k, REST[1] + (target[1] - REST[1]) * c.k];
      } else if (c.phase === 'away') {
        S.v = target;
      } else {
        S.v = [S.from[0] + (REST[0] - S.from[0]) * c.k, S.from[1] + (REST[1] - S.from[1]) * c.k];
      }
    }
    S.wasLive = S.live;

    drawGrid(p, S, S.v[0], S.v[1]);
    if (still) S.sleep(S.live ? Infinity : c.left);
  },
});
