// S02-484 wavy threads
// About sixty white threads hanging down a dark square, bunching into bright
// bundles and fanning apart. Every so often a slow sideways wave travels down
// through them, like water moving through kelp, swelling in and dying away so
// the threads settle back exactly where they were. With someone at the page,
// threads near the cursor bend aside to open a gap around it, like a finger
// drawn through hair, and spring back when it leaves.
import { dmSketch } from './harness.js';
import { LINES, STEP } from './S02-484.lines.js';

const bg = 22;
const ink = 238;

// Geometry, measured: the threads are cut by a square, x 363-917 and
// y 340-895, and are 2.3px wide. The threads themselves are traced from the original.
const TOP = 340;
const BOTTOM = 895;
const LEFT = 363;
const RIGHT = 917;
const WIDTH = 2.3;

// The sway: a wave of wavelength WAVE px travelling down every PERIOD s,
// leaning a little across the field, up to AMP px, eased in and out over SWAY
// seconds; then the threads hold still for HOLD seconds.
const AMP = 10;
const WAVE = 420;
const PERIOD = 9;
const LEAN = 1 / 260; // radians of phase per px across
const SWAY = 27;
const HOLD = 12;

// Parting: threads within ~PART_W px of the cursor are pushed up to PART px
// aside, fading over PART_H px up and down. tanh keeps their order.
const PART = 26;
const PART_W = 22;
const PART_H = 70;
const PART_IN = 3; // per second
const PART_OUT = 1.5;

const TAU = Math.PI * 2;
const smooth = (t) => t * t * (3 - 2 * t);

// [ys, xs] per thread. Threads that reach an edge of the square are extended
// past it so the clip cuts them cleanly while they sway.
const EXTEND = 6; // samples
function decode() {
  return LINES.map(([y0, enc]) => {
    const d = enc.split(',').map(Number);
    const xs = [];
    let v = 0;
    for (const dv of d) xs.push((v += dv) / 10);
    const ys = xs.map((_, i) => y0 + i * STEP);
    const nearSide = (x) => x < LEFT + 4 || x > RIGHT - 4;
    if (y0 <= TOP + 2) {
      xs.unshift(xs[0]);
      ys.unshift(TOP - 4);
    } else if (nearSide(xs[0])) {
      // it runs in from a side: carry it on out along its slope
      const dx = xs[0] - xs[1];
      for (let k = 1; k <= EXTEND; k++) {
        xs.unshift(xs[0] + dx);
        ys.unshift(ys[0] - STEP);
      }
    }
    if (ys[ys.length - 1] >= BOTTOM - STEP - 2) {
      xs.push(xs[xs.length - 1]);
      ys.push(BOTTOM + 4);
    } else if (nearSide(xs[xs.length - 1])) {
      const dx = xs[xs.length - 1] - xs[xs.length - 2];
      for (let k = 1; k <= EXTEND; k++) {
        xs.push(xs[xs.length - 1] + dx);
        ys.push(ys[ys.length - 1] + STEP);
      }
    }
    return [Float32Array.from(ys), Float32Array.from(xs)];
  });
}

function draw(p, S) {
  const ctx = p.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.rect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP);
  ctx.clip();
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineWidth = WIDTH;
  ctx.lineJoin = 'round';

  const amp = AMP * S.env;
  const wt = (TAU * S.wt) / PERIOD;
  const part = PART * smooth(S.part);
  const [mx, my] = S.partAt;
  ctx.beginPath();
  for (const [ys, xs] of S.lines) {
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      const y = ys[i];
      let dx = amp ? amp * Math.sin((TAU * y) / WAVE - wt + x * LEAN) : 0;
      if (part) {
        const v = (y - my) / PART_H;
        dx += part * Math.tanh((x - mx) / PART_W) * Math.exp(-0.5 * v * v);
      }
      if (i === 0) ctx.moveTo(x + dx, y);
      else ctx.lineTo(x + dx, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: [LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP], // the field of threads
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.lines = decode();
    S.state = 'hold';
    S.t = 0; // seconds into the sway
    S.wt = 0; // wave clock
    S.env = 0;
    S.part = 0;
    S.partAt = [0, 0];
    S.armed = false;
    S.lastMouse = [NaN, NaN];
    p.mouseMoved = () => {
      if (!p.isLooping()) p.loop();
    };
  },
  frame(p, S) {
    const dt = Math.min(p.deltaTime, 100) / 1000;

    if (S.state === 'sway') {
      S.t += dt;
      S.wt += dt;
      // sin^2 envelope: zero with zero slope at both ends
      const u = Math.min(S.t / SWAY, 1);
      S.env = Math.sin(Math.PI * u) ** 2;
      if (u >= 1) {
        S.state = 'hold';
        S.env = 0;
      }
    }

    // parting eases toward the cursor while it's over the field
    const over =
      S.live && S.mouseX > LEFT - 40 && S.mouseX < RIGHT + 40 && S.mouseY > TOP - 40 && S.mouseY < BOTTOM + 40;
    const target = over ? 1 : 0;
    if (over) {
      S.partAt[0] += (S.mouseX - S.partAt[0]) * Math.min(1, 12 * dt);
      S.partAt[1] += (S.mouseY - S.partAt[1]) * Math.min(1, 12 * dt);
      if (S.part === 0) S.partAt = [S.mouseX, S.mouseY];
    }
    const rate = (target > S.part ? PART_IN : PART_OUT) * dt;
    S.part = target > S.part ? Math.min(target, S.part + rate) : Math.max(target, S.part - rate);
    const parting = S.part !== target || (over && Math.hypot(S.mouseX - S.partAt[0], S.mouseY - S.partAt[1]) > 0.1);

    draw(p, S);

    const mouseMoved = S.live && (S.mouseX !== S.lastMouse[0] || S.mouseY !== S.lastMouse[1]);
    S.lastMouse[0] = S.mouseX;
    S.lastMouse[1] = S.mouseY;
    if (S.state === 'hold') {
      if (!S.armed) {
        S.armed = true;
        p.schedule(() => {
          S.armed = false;
          S.state = 'sway';
          S.t = 0;
          p.loop();
        }, HOLD * 1000);
      }
      if (!parting && !mouseMoved) p.noLoop();
    }
  },
  onActivate(p, S) {
    S.armed = false;
  },
});
