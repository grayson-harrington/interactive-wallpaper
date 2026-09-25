// S02-459 simple cubic
// A simple-cubic unit cell of paper "bobbles" joined by knocked-out bonds.
// Grab a bobble and it springs back when released. In ambient mode an
// invisible hand occasionally plucks one.
import { dmSketch } from './harness.js';

const sideLength = 200;
const halfSide = sideLength / 2;
const ballS = sideLength * 0.425;
const lineS = sideLength * 0.09;
const ballC = [108, 165, 181];
const backC = 239;
const primaryAlpha = 35;
const secondaryAlpha = 100;
const numPaperParticles = 20;

const rand = (a, b) => a + Math.random() * (b - a);

function bobbleImage(d) {
  const size = Math.ceil(d + 10);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const cx = size / 2;
  ctx.fillStyle = `rgb(${ballC.join(',')})`;
  ctx.beginPath();
  ctx.arc(cx, cx, d / 2, 0, Math.PI * 2);
  ctx.fill();
  for (let i = Math.floor(cx - d / 2); i < cx + d / 2; i += 2) {
    for (let j = Math.floor(cx - d / 2); j < cx + d / 2; j += 2) {
      if (Math.hypot(i - cx, j - cx) < d / 2) {
        const g = Math.round(rand(200, 255));
        ctx.fillStyle = `rgba(${g},${g},${g},${primaryAlpha / 255})`;
        ctx.fillRect(i, j, 2, 2);
      }
    }
  }
  for (let i = 0; i < numPaperParticles; i++) {
    const x = rand(cx - d / 2, cx + d / 2);
    const y = rand(cx - d / 2, cx + d / 2);
    if (Math.hypot(x - cx, y - cx) < d / 2) {
      const g = Math.round(rand(200, 255));
      ctx.fillStyle = `rgba(${g},${g},${g},${secondaryAlpha / 255})`;
      ctx.fillRect(x, y, rand(1, 3), rand(1, 3));
    }
  }
  return c;
}

const smoothstep = (t) => t * t * (3 - 2 * t);

function bobble(x, y, img) {
  return { rx: x, ry: y, x, y, vx: 0, vy: 0, d: ballS, maxOff: ballS * 1.5, grabbed: false, img, gx: 0, gy: 0 };
}

function update(b, mx, my) {
  if (b.grabbed) {
    const factor = 0.5;
    b.x = b.rx + (mx - b.rx) * factor;
    b.y = b.ry + (my - b.ry) * factor;
    const off = Math.hypot(b.x - b.rx, b.y - b.ry);
    if (off > b.maxOff) {
      b.x = b.rx + ((b.x - b.rx) / off) * b.maxOff;
      b.y = b.ry + ((b.y - b.ry) / off) * b.maxOff;
    }
    return;
  }
  if (Math.hypot(b.vx, b.vy) < 0.0001 && Math.hypot(b.x - b.rx, b.y - b.ry) < 5) {
    b.x = b.rx;
    b.y = b.ry;
    b.vx = b.vy = 0;
    return;
  }
  const k = 0.05;
  const damp = 0.95;
  b.vx = (b.vx + (b.rx - b.x) * k) * damp;
  b.vy = (b.vy + (b.ry - b.y) * k) * damp;
  b.x += b.vx;
  b.y += b.vy;
}

const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [0, 4], [1, 5], [2, 6], [3, 7],
  [4, 5], [5, 6], [6, 7], [7, 4],
];

export default dmSketch({
  ow: 500,
  oh: 500,
  bg: backC,
  init(p, S) {
    const img = bobbleImage(ballS);
    const sx = (sideLength * 2) / 5;
    const sy = (-sideLength * 2) / 5;
    const cx = S.ow / 2 - sideLength / 6;
    const cy = S.oh / 2 + sideLength / 6;
    const corners = [
      [-halfSide, -halfSide], [halfSide, -halfSide], [halfSide, halfSide], [-halfSide, halfSide],
      [-halfSide + sx, -halfSide + sy], [halfSide + sx, -halfSide + sy], [halfSide + sx, halfSide + sy], [-halfSide + sx, halfSide + sy],
    ];
    S.bobbles = corners.map(([x, y]) => bobble(x + cx, y + cy, img));
    S.nextPluck = 90;
    S.pluck = null;
  },
  frame(p, S) {
    p.background(backC);

    // ambient: grab a random bobble, pull it somewhere, let go
    if (!S.live) {
      if (S.pluck) {
        const pl = S.pluck;
        pl.t++;
        // ease the pull point out from rest instead of jumping there
        const k = smoothstep(Math.min(1, pl.t / pl.dragLen));
        pl.b.gx = pl.b.rx + (pl.tx - pl.b.rx) * k;
        pl.b.gy = pl.b.ry + (pl.ty - pl.b.ry) * k;
        if (pl.t > pl.dragLen + pl.hold) {
          pl.b.grabbed = false;
          S.pluck = null;
        }
      } else if (--S.nextPluck <= 0) {
        const b = S.bobbles[Math.floor(Math.random() * S.bobbles.length)];
        const a = Math.random() * Math.PI * 2;
        const r = rand(80, 200);
        b.grabbed = true;
        b.gx = b.rx;
        b.gy = b.ry;
        S.pluck = {
          b,
          t: 0,
          tx: b.rx + Math.cos(a) * r,
          ty: b.ry + Math.sin(a) * r,
          dragLen: Math.floor(rand(25, 45)),
          hold: Math.floor(rand(15, 40)),
        };
        S.nextPluck = Math.floor(rand(150, 420));
      }
    } else if (S.pluck) {
      S.pluck.b.grabbed = false;
      S.pluck = null;
    }

    const ctx = p.drawingContext;
    for (const b of S.bobbles) {
      ctx.drawImage(b.img, b.x - b.img.width / 2, b.y - b.img.height / 2);
      const [mx, my] = b === S.pluck?.b ? [b.gx, b.gy] : [S.mouseX, S.mouseY];
      update(b, mx, my);
    }

    p.stroke(backC);
    p.strokeCap(p.SQUARE);
    p.strokeWeight(lineS);
    for (const [a, c] of EDGES) p.line(S.bobbles[a].x, S.bobbles[a].y, S.bobbles[c].x, S.bobbles[c].y);
    p.noStroke();
    p.fill(backC);
    for (const b of S.bobbles) p.ellipse(b.x, b.y, lineS, lineS);
  },
  mousePressed(p, S) {
    if (S.pluck) {
      S.pluck.b.grabbed = false;
      S.pluck = null;
    }
    for (const b of S.bobbles) b.grabbed = Math.hypot(S.mouseX - b.x, S.mouseY - b.y) < b.d / 2;
  },
  mouseReleased(p, S) {
    for (const b of S.bobbles) b.grabbed = false;
  },
});
