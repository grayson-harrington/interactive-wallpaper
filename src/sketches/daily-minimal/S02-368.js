// S02-368 rectangles in circle
// Seeds grow into paper rectangles until they bump into each other, seen
// through a circular window. The original's per-frame random 1px grain is
// replayed from a few pre-rendered grain layers (same shimmer, far cheaper).
// Once everything has stopped growing it holds, then starts over
// (click, or Enter as in the original, restarts it right away).
import { dmSketch } from './harness.js';

const numRects = 50;
const minDist = 40;
const HOLD_MS = 12_000;
const GRAIN_ORIGIN = 450; // grain layers cover [-450, 450) in rect coordinates

function grainLayer() {
  const size = GRAIN_ORIGIN * 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  // paper(200, 100): area/5 random 1px dots of fill(200±10, 100±5)
  for (let n = 0; n < (size * size) / 5; n++) {
    const k = Math.floor(Math.random() * size * size) * 4;
    const g = 190 + Math.random() * 20;
    d[k] = d[k + 1] = d[k + 2] = g;
    d[k + 3] = 95 + Math.random() * 10;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

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
  S.holding = false;
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

function restart(p, S) {
  p.cancelScheduled();
  initRects(p, S);
  p.loop();
}

export default dmSketch({
  ow: 500,
  oh: 500,
  bg: 25,
  init(p, S) {
    S.grain = [grainLayer(), grainLayer(), grainLayer()];
    initRects(p, S);
  },
  frame(p, S) {
    const ctx = p.drawingContext;
    const grain = S.grain[p.frameCount % S.grain.length];
    p.background(25);
    p.translate(S.ow / 2, S.oh / 2);
    p.rotate(Math.PI / 4);
    for (const r of S.rects) {
      p.fill(230);
      p.noStroke();
      p.rectMode(p.CORNERS);
      p.rect(r.w1, r.h1, r.w2, r.h2);
      // grain, clipped to the rect's intersection with the grain layer
      const x1 = Math.max(r.w1, -GRAIN_ORIGIN);
      const y1 = Math.max(r.h1, -GRAIN_ORIGIN);
      const x2 = Math.min(r.w2, GRAIN_ORIGIN);
      const y2 = Math.min(r.h2, GRAIN_ORIGIN);
      if (x2 > x1 && y2 > y1) {
        ctx.drawImage(grain, x1 + GRAIN_ORIGIN, y1 + GRAIN_ORIGIN, x2 - x1, y2 - y1, x1, y1, x2 - x1, y2 - y1);
      }
      update(S, r);
    }
    p.stroke(25);
    p.noFill();
    p.strokeWeight(500);
    p.ellipse(0, 0, 850, 850);

    if (!S.holding && S.rects.every((r) => !r.growing)) {
      S.holding = true;
      p.schedule(() => {
        initRects(p, S);
        p.loop();
      }, HOLD_MS);
      p.noLoop();
    }
  },
  onActivate(p, S) {
    S.holding = false; // the hold timer was cancelled when hidden; re-arm it
  },
  mousePressed(p, S) {
    restart(p, S);
  },
  keyReleased(p, S) {
    if (p.keyCode === p.ENTER || p.keyCode === p.RETURN) restart(p, S);
  },
});
