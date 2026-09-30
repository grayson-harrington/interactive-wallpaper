// S02-265 arches in a circle
// Concentric arches, straight on the way down, clipped to a disc: a
// fingerprint of 27 lines 11.5px apart around a single line up the middle.
// After a 15s rest, over 36s two pulses travel out from the middle to the rim,
// each nudging the arches it passes outward as it goes by, and the arches are
// back where they were. With someone at the page the arches' center follows
// the cursor inside the disc; when they leave it eases back to the middle.
import { dmSketch } from './harness.js';
import { pose } from './pose.js';

const bg = 239;
const ink = 12;

// Geometry, measured.
const CX = 639.5;
const CY = 627;
const PITCH = 11.5;
const ARCHES = 26; // the outermost one is the disc's rim; more lie outside it
const DISC = 299.5;
const LINE_W = 2.6;
const DRAWN = 44; // arches drawn, so the fingerprint still fills the disc off center

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;
const PULSES = 2;
const LAG = 0.25; // share of AWAY between the pulses' starts
const PUSH = 7; // px a passing pulse moves an arch outward
const WIDTH = 2.4; // arches
const FOLLOW = 2.5; // per second
const PULL = 0.4; // how far the center goes toward the cursor
const REACH = 110; // and at most this far, px
const SETTLE = 6;

const smooth = (t) => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;

// pulse fronts, in arches from the middle: start before the first, end past the rim
const FROM = -7;
const TO = ARCHES + 7;

function draw(p, S, [ox, oy, front0, front1]) {
  const ctx = p.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, DISC, 0, TAU);
  ctx.clip();
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineWidth = LINE_W;
  ctx.lineCap = 'butt';
  const fronts = [front0, front1];
  const x = CX + ox;
  const y = CY + oy;
  const drop = 2 * DISC + REACH;
  ctx.beginPath();
  for (let k = 0; k <= DRAWN; k++) {
    let r = k * PITCH;
    for (let i = 0; i < PULSES; i++) {
      const d = (k - fronts[i]) / WIDTH;
      if (d > -3 && d < 3) r += PUSH * Math.exp(-d * d);
    }
    if (k === 0 && r < 0.01) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + drop);
      continue;
    }
    ctx.moveTo(x - r, y + drop);
    ctx.lineTo(x - r, y);
    ctx.arc(x, y, r, Math.PI, TAU);
    ctx.lineTo(x + r, y + drop);
  }
  ctx.stroke();
  ctx.restore();
}

export default dmSketch({
  ow: 1280,
  oh: 1280,
  art: [CX - DISC, CY - DISC, 2 * DISC, 2 * DISC],
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    S.pose = pose({
      rest: [0, 0, FROM, FROM], // [center offset x, y, the two pulse fronts]
      hold: HOLD,
      away: AWAY,
      settle: SETTLE,
      ambient(c, v) {
        for (let i = 0; i < PULSES; i++) {
          const t = Math.min(1, Math.max(0, (c.u - i * LAG) / (1 - (PULSES - 1) * LAG)));
          v[2 + i] = FROM + (TO - FROM) * smooth(t);
        }
        v[0] = 0;
        v[1] = 0;
      },
      // the arches' center follows the cursor
      live(S, v, dt) {
        const k = Math.min(1, FOLLOW * dt);
        let dx = (S.mouseX - CX) * PULL;
        let dy = (S.mouseY - CY) * PULL;
        const d = Math.hypot(dx, dy);
        if (d > REACH) [dx, dy] = [(dx * REACH) / d, (dy * REACH) / d];
        v[0] += (dx - v[0]) * k;
        v[1] += (dy - v[1]) * k;
        v[2] = v[3] = FROM;
      },
    });
  },
  frame(p, S) {
    const { pose: v, still, left } = S.pose.step(S);
    draw(p, S, v);
    if (still) S.sleep(left);
  },
});
