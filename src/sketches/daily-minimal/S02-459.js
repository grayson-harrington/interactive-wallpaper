// S02-459 simple cubic
// A simple-cubic unit cell of paper "bobbles" joined by knocked-out bonds.
// Grab a bobble and it springs back when released. In ambient mode it rests
// on the original, and every 12-20s an invisible hand plucks one.
import { dmSketch } from './harness.js';
import { paperCanvas, fillPathWithTexture } from '../../lib/paper.js';

const sideLength = 200;
const halfSide = sideLength / 2;
const ballS = sideLength * 0.425;
const lineS = sideLength * 0.09;
const ballC = [108, 165, 181];
const backC = 239;
const primaryAlpha = 35;
const secondaryAlpha = 100;
const numPaperParticles = 20;

// Timing, in seconds. The spring runs in fixed steps at the original's 60fps.
const REST = [12, 20]; // between plucks
const DRAG = [0.4, 0.75]; // pulling a bobble out
const PULL_HOLD = [0.25, 0.67]; // holding it before letting go
const SPRING_HZ = 60;

const rand = (a, b) => a + Math.random() * (b - a);

function bobbleImage(d) {
  const size = Math.ceil(d + 10);
  const tex = paperCanvas(size, size, {
    base: ballC,
    grainAlpha: [primaryAlpha, primaryAlpha],
    specks: numPaperParticles,
    speckAlpha: [secondaryAlpha, secondaryAlpha],
  });
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, d / 2, 0, Math.PI * 2);
  fillPathWithTexture(ctx, tex);
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
  art: [74, 60, 366, 366], // the unit cell
  scale: 1,
  bg: backC,
  fps: 30,
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
    S.nextPluck = rand(...REST);
    S.pluck = null;
    S.acc = 0;
    S.settled = true;
  },
  frame(p, S) {
    p.background(backC);

    // ambient: grab a random bobble, pull it somewhere, let go
    if (!S.live) {
      if (S.pluck) {
        const pl = S.pluck;
        pl.t += S.dt;
        // ease the pull point out from rest instead of jumping there
        const k = smoothstep(Math.min(1, pl.t / pl.dragLen));
        pl.b.gx = pl.b.rx + (pl.tx - pl.b.rx) * k;
        pl.b.gy = pl.b.ry + (pl.ty - pl.b.ry) * k;
        if (pl.t > pl.dragLen + pl.hold) {
          pl.b.grabbed = false;
          S.pluck = null;
        }
      } else if (S.settled && (S.nextPluck -= S.dt) <= 0) {
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
          dragLen: rand(...DRAG),
          hold: rand(...PULL_HOLD),
        };
        S.nextPluck = rand(...REST);
      }
    } else if (S.pluck) {
      S.pluck.b.grabbed = false;
      S.pluck = null;
    }

    const ctx = p.drawingContext;
    for (const b of S.bobbles) ctx.drawImage(b.img, b.x - b.img.width / 2, b.y - b.img.height / 2);

    p.stroke(backC);
    p.strokeCap(p.SQUARE);
    p.strokeWeight(lineS);
    for (const [a, c] of EDGES) p.line(S.bobbles[a].x, S.bobbles[a].y, S.bobbles[c].x, S.bobbles[c].y);
    p.noStroke();
    p.fill(backC);
    for (const b of S.bobbles) p.ellipse(b.x, b.y, lineS, lineS);

    // the spring, in fixed steps
    S.acc = Math.min(S.acc + S.dt * SPRING_HZ, 6);
    for (; S.acc >= 1; S.acc--) {
      for (const b of S.bobbles) {
        const [mx, my] = b === S.pluck?.b ? [b.gx, b.gy] : [S.mouseX, S.mouseY];
        update(b, mx, my);
      }
    }

    // everything at rest: the wait for the next pluck runs from here, asleep
    // (input wakes it sooner)
    const still = !S.pluck && S.bobbles.every((b) => !b.grabbed && b.x === b.rx && b.y === b.ry);
    S.settled = still;
    if (still) S.sleep(S.live ? Infinity : S.nextPluck);
  },
  mousePressed(p, S) {
    p.loop();
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
