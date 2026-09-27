// S02-368 rectangles in circle
// Paper rectangles seen through a circular window. At rest they are the
// original's layout, measured from the archive image. After a 15s hold they
// shrink away and seeds grow into a new layout until they bump into each
// other, as in the original sketch; that one shrinks away in turn and the
// original grows back. The original's per-frame random 1px grain is replayed
// from a few pre-rendered grain layers (same look, far cheaper).
// A click grows a new layout right away.
import { dmSketch, restCycle } from './harness.js';
import { dotPaperCanvas } from '../../lib/paper.js';

const numRects = 50;
const minDist = 40;

// The original's rectangles, [x1, y1, x2, y2] in the window's turned frame;
// ones cut by the circle run on past it.
const REST = [
  [-54, -253, 68.5, -141],
  [-159, -242.5, -62, -155.5],
  [-241, -230.5, -84, -67],
  [73.5, -229, 148.5, -73.5],
  [-77, -138, -14.5, -101.5],
  [-12.5, -132, 72.5, -47.5],
  [-79, -98.5, -47.5, -66.5],
  [-45.5, -93, -14.5, 6],
  [154, -160.5, 235.5, -77],
  [78, -68.5, 248, -45.5],
  [-248.5, -58.5, -152, -39.5],
  [-145, -61.5, -47, -38],
  [102.5, -39, 253.5, 45],
  [-10.5, -39.5, 95.5, 66.5],
  [-253, -33, -104, 15.5],
  [-98, -33, -50, 15],
  [-45.5, 7.5, -14.5, 38.5],
  [-252, 19, -123, 34.5],
  [-120.5, 22, -52.5, 89.5],
  [-248.5, 41.5, -124.5, 89.5],
  [-49.5, 45, -18.5, 116.5],
  [109, 54.5, 246, 63.5],
  [108.5, 68.5, 128.5, 114.5],
  [133.5, 71.5, 239.5, 193.5],
  [-14.5, 73, 106.5, 119],
  [-225.5, 96, -54.5, 243],
  [10, 123, 84.5, 253.5],
  [90.5, 124, 199.5, 229],
  [-54, 127.5, 1.5, 253.5],
];

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6; // the original shrinks away
const AWAY = 28; // a new layout grows, rests, and shrinks away in its last SHRINK seconds
const BACK = 7; // the original grows back
const SHRINK = 5;
const STEPS = 2; // growth steps per frame: the original grew once a frame at 60fps
const GRAIN_ORIGIN = 450; // grain layers cover [-450, 450) in rect coordinates

// paper(200, 100): gray 200±10 dots at alpha 100±5, as a transparent layer
const grainLayer = () => dotPaperCanvas(GRAIN_ORIGIN * 2, GRAIN_ORIGIN * 2, { gray: [190, 210], alpha: [95, 105] });

function initRects(p, S) {
  const width = S.ow;
  const height = S.oh;
  S.rects = [];
  for (let i = 0; i < numRects; i++) {
    let x = 0;
    let y = 0;
    let ok = false;
    for (let count = 0; !ok && count <= 100; count++) {
      x = p.random(-width / 2 - 100, width / 2 + 100);
      y = p.random(-height / 2 - 100, height / 2 + 100);
      ok = S.rects.every((r) => Math.hypot(r.x - x, r.y - y) >= minDist);
    }
    if (ok) {
      S.rects.push({
        x,
        y,
        w1: x - 1,
        w2: x + 1,
        h1: y - 1,
        h2: y + 1,
        sw1: p.random(1, 5),
        sw2: p.random(1, 5),
        sh1: p.random(1, 5),
        sh2: p.random(1, 5),
        edge: p.random(10, 15),
        growing: true,
      });
    }
  }
}

function update(S, r) {
  if (!r.growing) return;
  const { ow: width, oh: height } = S;
  r.sw1 = r.w1 - r.sw1 < r.edge ? 0 : r.sw1;
  r.sw2 = Math.abs(r.w2 + r.sw2 - width) < r.edge ? 0 : r.sw2;
  r.sh1 = r.h1 - r.sh1 < r.edge ? 0 : r.sh1;
  r.sh2 = Math.abs(r.h2 + r.sh2 - height) < r.edge ? 0 : r.sh2;
  for (const o of S.rects) {
    if ((o.h1 > r.h1 && o.h1 < r.h2) || (o.h2 > r.h1 && o.h2 < r.h2) || (o.h1 < r.h1 && o.h2 > r.h2)) {
      r.sw1 = Math.abs(r.w1 - r.sw1 - o.w2) < r.edge ? 0 : r.sw1;
      r.sw2 = Math.abs(r.w2 + r.sw2 - o.w1) < r.edge ? 0 : r.sw2;
    }
    if ((o.w1 > r.w1 && o.w1 < r.w2) || (o.w2 > r.w1 && o.w2 < r.w2) || (o.w1 < r.w1 && o.w2 > r.w2)) {
      r.sh1 = Math.abs(r.h1 - r.sh1 - o.h2) < r.edge ? 0 : r.sh1;
      r.sh2 = Math.abs(r.h2 + r.sh2 - o.h1) < r.edge ? 0 : r.sh2;
    }
  }
  if (r.sw1 === 0 && r.sw2 === 0 && r.sh1 === 0 && r.sh2 === 0) r.growing = false;
  r.w1 -= r.sw1;
  r.w2 += r.sw2;
  r.h1 -= r.sh1;
  r.h2 += r.sh2;
}

// A rect scaled about its own center by k (0: a point, 1: full size).
function drawRect(p, S, grain, w1, h1, w2, h2, k) {
  if (k <= 0) return;
  const cx = (w1 + w2) / 2;
  const cy = (h1 + h2) / 2;
  const x1 = cx + (w1 - cx) * k;
  const y1 = cy + (h1 - cy) * k;
  const x2 = cx + (w2 - cx) * k;
  const y2 = cy + (h2 - cy) * k;
  p.rect(x1, y1, x2, y2);
  // grain, clipped to the rect's intersection with the grain layer
  const gx1 = Math.max(x1, -GRAIN_ORIGIN);
  const gy1 = Math.max(y1, -GRAIN_ORIGIN);
  const gx2 = Math.min(x2, GRAIN_ORIGIN);
  const gy2 = Math.min(y2, GRAIN_ORIGIN);
  if (gx2 > gx1 && gy2 > gy1) {
    S.ctx.drawImage(grain, gx1 + GRAIN_ORIGIN, gy1 + GRAIN_ORIGIN, gx2 - gx1, gy2 - gy1, gx1, gy1, gx2 - gx1, gy2 - gy1);
  }
}

const smooth = (t) => t * t * (3 - 2 * t);

export default dmSketch({
  ow: 500,
  oh: 500,
  art: [75, 75, 350, 350], // the circle
  scale: 1,
  bg: 22,
  fps: 30,
  init(p, S) {
    S.grain = [grainLayer(), grainLayer(), grainLayer()];
    S.rects = [];
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
  },
  frame(p, S) {
    const c = S.cycle.step(S.dt);
    if (c.phase === 'away' && c.turned) initRects(p, S);
    S.ctx = p.drawingContext;
    const grain = S.grain[p.frameCount % S.grain.length];
    p.background(22);
    p.translate(S.ow / 2, S.oh / 2);
    p.rotate(Math.PI / 4);
    p.fill(230);
    p.noStroke();
    p.rectMode(p.CORNERS);

    let settled = true;
    if (c.phase === 'away') {
      const t = c.u * AWAY;
      const k = 1 - smooth(Math.min(1, Math.max(0, (t - (AWAY - SHRINK)) / SHRINK)));
      for (const r of S.rects) {
        drawRect(p, S, grain, r.w1, r.h1, r.w2, r.h2, k);
        for (let i = 0; i < STEPS; i++) update(S, r);
        if (r.growing) settled = false;
      }
      // grown and resting: sleep until it shrinks away
    } else {
      // the original: shrinking away, growing back, or at rest
      const k = c.phase === 'leave' ? 1 - c.k : c.phase === 'back' ? c.k : 1;
      for (const [w1, h1, w2, h2] of REST) drawRect(p, S, grain, w1, h1, w2, h2, k);
    }

    p.stroke(22);
    p.noFill();
    p.strokeWeight(500);
    p.ellipse(0, 0, 850, 850);

    if (c.phase === 'hold') S.sleep(c.left);
    else if (c.phase === 'away' && settled && c.u * AWAY < AWAY - SHRINK) S.sleep(AWAY - SHRINK - c.u * AWAY);
  },
  mousePressed(p, S) {
    growNew(p, S);
  },
});

// Skip ahead to a freshly growing layout.
function growNew(p, S) {
  const c = S.cycle;
  if (c.phase === 'away') initRects(p, S);
  else while (c.phase !== 'away') c.skip();
  p.loop();
}
