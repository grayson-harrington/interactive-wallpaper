// S02-128 string-art triangle
// An equilateral outline with a fan of lines from each base corner to the
// opposite side, every 5 degrees, crossing into a curved grid. After a 15s
// rest, over 36s the two fans spread and collapse, one after the other: the
// angle between the lines opens (lines slide off the side one by one) and
// closes (new ones slide in from the side), until both are back at 5 degrees.
// With someone at the page the two fans follow a point the cursor drags around
// inside the triangle (the crossing of one line from each fan, so the fans
// swing independently as it moves); when they leave it eases back to 5
// degrees.
import { dmSketch } from './harness.js';
import { paperCanvas } from '../../lib/paper.js';
import { pose } from './pose.js';

const bg = 22;
const ink = 244;

// Geometry, measured on the 5000px original and drawn at a fifth of it. The
// outline's outer bounds; the strokes are centered inside them.
const CX = 499.9;
const APEX_Y = 259;
const BASE_Y = 681;
const SIDE = 487;
const OUTLINE_W = 4;
const FAN_W = 2.3;
const STEP = 5; // degrees between the lines at rest
const SKEW = 0.06;

// Timing, in seconds.
const HOLD = 15;
const AWAY = 36;
const OCTAVES = 1; // the angle between lines spreads to 2x and tightens to 1/2
const FOLLOW = 2.5; // per second
const TRACKED = 6; // the line from each fan that crosses at the followed point
const PULL = 0.35; // how far the point goes for the cursor's distance from the middle
const MIN_STEP = 2.5; // limits on the angle between lines while following
const MAX_STEP = 9.5;
const SETTLE = 6;

const smooth = (t) => t * t * (3 - 2 * t);
const rad = Math.PI / 180;

// The stroked path's corners: the outer triangle pulled in by half the stroke.
const INC_Y = BASE_Y - SIDE / (2 * Math.sqrt(3));
const IN = (INC_Y - APEX_Y - OUTLINE_W / 2) / (INC_Y - APEX_Y);
const T = {
  apex: [CX, INC_Y + IN * (APEX_Y - INC_Y)],
  left: [CX - IN * (SIDE / 2), INC_Y + IN * (BASE_Y - INC_Y)],
  right: [CX + IN * (SIDE / 2), INC_Y + IN * (BASE_Y - INC_Y)],
  side: IN * SIDE,
};

// Lines from a base corner at angles step, 2 step, ... up to the opposite
// side (dir is +1 from the left corner, -1 from the right). Measured: the
// lines sit a hair (0.06 step) above whole steps.
function fan(ctx, [x, y], dir, stepDeg) {
  const sin60 = Math.sin(60 * rad);
  for (let a = stepDeg * (1 + SKEW); a < 59.9; a += stepDeg) {
    const len = (T.side * sin60) / Math.sin((120 - a) * rad);
    ctx.moveTo(x, y);
    ctx.lineTo(x + dir * len * Math.cos(a * rad), y - len * Math.sin(a * rad));
  }
}

// Where the tracked lines cross at rest: the middle, a little above the center.
const MID = [T.apex[0], T.left[1] - (T.apex[0] - T.left[0]) * Math.tan(STEP * (TRACKED + SKEW) * rad)];

function draw(p, S, [left, right]) {
  const ctx = p.drawingContext;
  ctx.strokeStyle = `rgb(${ink},${ink},${ink})`;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  ctx.lineWidth = FAN_W;
  ctx.beginPath();
  fan(ctx, T.left, 1, left);
  fan(ctx, T.right, -1, right);
  ctx.stroke();

  ctx.lineWidth = OUTLINE_W;
  ctx.beginPath();
  ctx.moveTo(...T.apex);
  ctx.lineTo(...T.right);
  ctx.lineTo(...T.left);
  ctx.closePath();
  ctx.stroke();

  ctx.drawImage(S.flecks, S.fx, S.fy);
}

export default dmSketch({
  ow: 1000,
  oh: 1000,
  art: [256.4, APEX_Y, SIDE, BASE_Y - APEX_Y],
  scale: 1,
  bg,
  fps: 30,
  init(p, S) {
    const w = Math.ceil(SIDE) + 8;
    const h = BASE_Y - APEX_Y + 8;
    [S.fx, S.fy] = [CX - w / 2, APEX_Y - 4];
    // paper flecks over the white
    S.flecks = paperCanvas(w, h, {
      transparent: true,
      grainAlpha: [0, 0],
      specks: Math.round((w * h) / 500),
      speckAlpha: [70, 200],
      speckGray: [8, 60],
      speckSize: [0.6, 1.6],
    });
    S.pose = pose({
      rest: [STEP, STEP], // angle between the lines of the left and right fans
      hold: HOLD,
      away: AWAY,
      settle: SETTLE,
      // the two fans breathe out of step, ending together
      ambient(c, v) {
        const e = Math.sin(Math.PI * c.u) ** 2;
        v[0] = STEP * 2 ** (OCTAVES * e * Math.sin(3 * Math.PI * c.u));
        v[1] = STEP * 2 ** (OCTAVES * e * Math.sin(3 * Math.PI * c.u - 1.2));
      },
      // a point follows the cursor, scaled down and eased; each fan swings so
      // its tracked line passes through it
      live(S, v, dt) {
        const qx = MID[0] + (S.mouseX - MID[0]) * PULL;
        const qy = MID[1] + (S.mouseY - MID[1]) * PULL;
        const k = Math.min(1, FOLLOW * dt);
        const aim = [
          Math.atan2(T.left[1] - qy, qx - T.left[0]) / rad,
          Math.atan2(T.right[1] - qy, T.right[0] - qx) / rad,
        ];
        for (let i = 0; i < 2; i++) {
          const target = Math.min(MAX_STEP, Math.max(MIN_STEP, aim[i] / (TRACKED + SKEW)));
          v[i] *= (target / v[i]) ** k;
        }
      },
    });
  },
  frame(p, S) {
    const { pose: v, still, left } = S.pose.step(S);
    draw(p, S, v);
    if (still) S.sleep(left);
  },
});
