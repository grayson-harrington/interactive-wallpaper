// S02-404 rotating concentric circles
// Three sets of alternating bands, each rotating and carried around by the
// one outside it. At rest they sit at the original's angles (fitted to the
// archive image). After a 15s hold the rotation eases up to speed, turns for
// a while, then each set coasts to a stop back on its original angle. The
// dark bands are grainy paper, as in the original; each set's paper turns
// with it. With someone at the page, the three sets turn, always eased, to
// bring the smallest circle as close to the cursor as they can: inside the
// circle it reaches for the cursor, and beyond its reach every set lines up
// toward it. When they leave, each set eases back to its original angle.
import { dmSketch, restCycle, coastTo } from './harness.js';
import { paperCanvas, fillPathWithTexture } from '../../lib/paper.js';

const light = 238;
const dark = 35;

// Rest angles of the three sets, fitted to the original.
const REST = [0.8178, 4.1564, 1.5911];

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6; // easing up to speed
const AWAY = 26;
const BACK = 7; // coasting to a stop on the rest angles
const FOLLOW = 2.5; // per second, turning toward the cursor
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Angles that bring the innermost dot (the end of the chain: each set's angle
// places the next one's center, and the smallest set's angle places the dot)
// closest to the point (mx, my). One set at a time is pointed at the target
// from where the others leave it; a few passes settle it. Out of reach, every
// set ends up pointing at the target.
function reach(S, mx, my, out) {
  const [c0] = S.circs;
  const L = S.links;
  for (let pass = 0; pass < 6; pass++) {
    for (let j = 0; j < 3; j++) {
      let x = mx - c0.x;
      let y = my - c0.y;
      for (let k = 0; k < 3; k++) {
        if (k === j) continue;
        x -= L[k] * Math.cos(out[k]);
        y -= L[k] * Math.sin(out[k]);
      }
      out[j] = Math.atan2(y, x);
    }
  }
}

function circle(x, y, d, bandThickness, numBands) {
  // turning speed as in the original: 2/d radians per frame at 60fps
  return { x, y, d, bandThickness, numBands, a: 0, w: (2 / d) * 60, dist: 0 };
}

export default dmSketch({
  ow: 700,
  oh: 700,
  art: [100, 100, 500, 500], // the outer circle
  scale: 1,
  bg: light,
  fps: 30,
  init(p, S) {
    const height = S.oh;
    const c0 = circle(S.ow / 2, height / 2, 500, 25, 8);
    let d = c0.d - c0.bandThickness * c0.numBands;
    const c1 = circle(c0.x + c0.d / 2 - d / 2, height / 2, d, 25, 6);
    c1.dist = c1.x - c0.x;
    d = c1.d - c1.bandThickness * c1.numBands;
    const c2 = circle(c1.x + c1.d / 2 - d / 2, height / 2, d, 25, 6);
    c2.dist = c2.x - c1.x;
    S.circs = [c0, c1, c2];
    // grain and specks tuned to the original's dark bands
    for (const c of S.circs) {
      c.paper = paperCanvas(c.d, c.d, {
        base: 22,
        grainAlpha: [4, 34],
        specks: (c.d * c.d) / 140,
        speckSize: [0.5, 1.8],
        speckAlpha: [90, 170],
      });
    }
    S.circs.forEach((c, i) => (c.a = REST[i]));
    // chain links: middle center, smallest center, innermost dot (the smallest
    // set's second-to-last band, the last one having no size)
    S.links = [c1.dist, c2.dist, (c2.bandThickness * (c2.numBands - 1)) / 2];
    S.target = [...REST];
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
    S.wasLive = false;
  },
  frame(p, S) {
    const c = S.cycle;
    let still = false;
    if (S.live) {
      // solve from the current pose so the chain keeps its bend, then ease there
      S.target = S.circs.map((ci) => ci.a);
      reach(S, S.mouseX, S.mouseY, S.target);
      const k = 1 - Math.exp(-FOLLOW * S.dt);
      still = true;
      S.circs.forEach((ci, i) => {
        const d = wrap(S.target[i] - ci.a);
        ci.a += d * k;
        if (Math.abs(d) > 1e-3) still = false;
      });
    } else {
      if (S.wasLive) {
        c.toRest(BACK);
        // eased the short way round to each rest angle
        S.circs.forEach((ci, i) => {
          const from = ci.a;
          const to = from + wrap(REST[i] - from);
          ci.home = (u) => from + (to - from) * u * u * (3 - 2 * u);
        });
      } else {
        c.step(S.dt);
        if (c.phase === 'back' && c.turned) S.circs.forEach((ci, i) => (ci.home = coastTo(ci.a, ci.w, REST[i], BACK)));
      }
    }
    S.wasLive = S.live;
    if (S.live) {
      // following the cursor
    } else if (c.phase === 'leave' || c.phase === 'away') {
      const rate = c.phase === 'leave' ? c.k : 1;
      for (const ci of S.circs) ci.a += ci.w * rate * S.dt;
    } else if (c.phase === 'back') {
      for (const ci of S.circs) ci.a = ci.home(c.u);
    } else {
      S.circs.forEach((ci, i) => (ci.a = REST[i]));
    }

    p.background(light);
    p.noStroke();
    p.fill(light);
    const ctx = p.drawingContext;
    S.circs.forEach((ci, i) => {
      if (i !== 0) {
        const parent = S.circs[i - 1];
        ci.x = parent.x + ci.dist * Math.cos(parent.a);
        ci.y = parent.y + ci.dist * Math.sin(parent.a);
      }
      p.push();
      p.translate(ci.x, ci.y);
      p.rotate(ci.a);
      for (let b = 0; b <= ci.numBands; b++) {
        const t = ci.bandThickness * b;
        if (b % 2 === 0) {
          ctx.beginPath();
          ctx.arc(t / 2, 0, (ci.d - t) / 2, 0, Math.PI * 2);
          fillPathWithTexture(ctx, ci.paper, -ci.d / 2, -ci.d / 2);
        } else {
          p.ellipse(t / 2, 0, ci.d - t, ci.d - t);
        }
      }
      p.pop();
    });
    if (S.live ? still : c.phase === 'hold') S.sleep(S.live ? Infinity : c.left);
  },
});
