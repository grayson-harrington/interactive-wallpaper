// Flocking  (Processing Round 3/Flocking/flocking_Shiffman)
//
// Craig Reynolds' boids as in Shiffman's Nature of Code example: separation,
// alignment and cohesion, wrap-around edges. Throttled for a wallpaper:
//   - flock capped at 90 boids (was 150; clicking can add up to MAX_BOIDS)
//   - drawn at 30fps, with two simulation steps per frame so the motion keeps
//     the original 60Hz speed
// Interactive: click to add a boid at the cursor, as in the original.

const START_BOIDS = 90;
const MAX_BOIDS = 150;
const STEPS_PER_FRAME = 2;

function limit(v, max) {
  const m = Math.hypot(v[0], v[1]);
  if (m > max) {
    v[0] = (v[0] / m) * max;
    v[1] = (v[1] / m) * max;
  }
  return v;
}

function setMag(v, mag) {
  const m = Math.hypot(v[0], v[1]);
  if (m > 0) {
    v[0] = (v[0] / m) * mag;
    v[1] = (v[1] / m) * mag;
  }
  return v;
}

function makeBoid(x, y) {
  const a = Math.random() * Math.PI * 2;
  return { x, y, vx: Math.cos(a), vy: Math.sin(a), r: 3, maxspeed: 2, maxforce: 0.03 };
}

function flock(b, boids) {
  const desiredseparation = 25;
  const neighbordist = 50;
  const sep = [0, 0];
  const ali = [0, 0];
  const coh = [0, 0];
  let nSep = 0;
  let nNear = 0;
  for (const o of boids) {
    const dx = b.x - o.x;
    const dy = b.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < desiredseparation) {
      sep[0] += dx / d / d;
      sep[1] += dy / d / d;
      nSep++;
    }
    if (d > 0 && d < neighbordist) {
      ali[0] += o.vx;
      ali[1] += o.vy;
      coh[0] += o.x;
      coh[1] += o.y;
      nNear++;
    }
  }
  const acc = [0, 0];
  const steer = (desired, w) => {
    setMag(desired, b.maxspeed);
    const s = limit([desired[0] - b.vx, desired[1] - b.vy], b.maxforce);
    acc[0] += s[0] * w;
    acc[1] += s[1] * w;
  };
  if (nSep > 0 && (sep[0] || sep[1])) steer([sep[0] / nSep, sep[1] / nSep], 1.5);
  if (nNear > 0) {
    steer([ali[0] / nNear, ali[1] / nNear], 1.0);
    steer([coh[0] / nNear - b.x, coh[1] / nNear - b.y], 1.0); // seek(center)
  }
  return acc;
}

export default function flocking(p) {
  let boids = [];

  function step() {
    const accs = boids.map((b) => flock(b, boids));
    boids.forEach((b, i) => {
      b.vx += accs[i][0];
      b.vy += accs[i][1];
      const v = limit([b.vx, b.vy], b.maxspeed);
      b.vx = v[0];
      b.vy = v[1];
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -b.r) b.x = p.width + b.r;
      if (b.y < -b.r) b.y = p.height + b.r;
      if (b.x > p.width + b.r) b.x = -b.r;
      if (b.y > p.height + b.r) b.y = -b.r;
    });
  }

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    for (let i = 0; i < START_BOIDS; i++) boids.push(makeBoid(p.width / 2, p.height / 2));
  };

  p.draw = () => {
    for (let s = 0; s < STEPS_PER_FRAME; s++) step();

    p.background(50);
    p.fill(200, 100);
    p.stroke(255);
    p.strokeWeight(1);
    for (const b of boids) {
      const theta = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      p.push();
      p.translate(b.x, b.y);
      p.rotate(theta);
      p.triangle(0, -b.r * 2, -b.r, b.r * 2, b.r, b.r * 2);
      p.pop();
    }
  };

  p.mousePressed = () => {
    boids.push(makeBoid(p.mouseX, p.mouseY));
    if (boids.length > MAX_BOIDS) boids = boids.slice(boids.length - MAX_BOIDS);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
}
