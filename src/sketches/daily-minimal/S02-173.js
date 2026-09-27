// S02-173 max line segments
// Points on a circle, paired up every frame so the total length of the
// connecting chords is as large as possible. At rest the six points sit where
// the original has them. After a 15s hold they start to drift, wander for a
// while, then coast to a stop back on their original places.
// A click adds a line: a point where you click and one across the circle from
// it, up to six lines. Once the clicks stop, the added lines fade away one at
// a time, back to the original three.
import { dmSketch, restCycle, coastTo } from './harness.js';

// Measured from the original.
const lineC = 235;
const backC = 22;
const pointD = 14;
const RING_W = 8;
const CHORD_W = 4.2;
const r = 200;
const REST = [101, 124, 144, 234.5, 308, 321].map((d) => (d * Math.PI) / 180);
const maxPoints = 12;

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6;
const AWAY = 28;
const BACK = 7;
const DRIFT = (Math.PI / 400) * 60; // fastest drift, radians per second (the original's per-frame step at 60fps)
const NOISE = 60; // noise offset per second, times each point's xinc
const GROW = 0.6; // an added point growing in
const FADE = 1.2; // an added line fading out
const QUIET = 8; // after the last click, before added lines start to go
const DRAIN = 3; // between added lines going

function makePoint(p, rest, size = 1) {
  return { xoff: p.random(10000), xinc: p.random(0.0005, 0.0008), a: rest, rest, v: 0, x: 0, y: 0, size, grow: 0 };
}

// Best perfect matching by brute force (at most 12 points = 10395 pairings).
function bestPairs(points) {
  let best = null;
  let bestLen = -1;
  const pairs = [];
  const rec = (rest, len) => {
    if (rest.length < 2) {
      if (len > bestLen) {
        bestLen = len;
        best = pairs.slice();
      }
      return;
    }
    const [first, ...others] = rest;
    for (let i = 0; i < others.length; i++) {
      const second = others[i];
      pairs.push([first, second]);
      rec(
        others.filter((_, j) => j !== i),
        len + Math.hypot(first.x - second.x, first.y - second.y),
      );
      pairs.pop();
    }
  };
  rec(points, 0);
  return best || [];
}

export default dmSketch({
  ow: 600,
  oh: 600,
  art: [100, 100, 400, 400], // the circle
  scale: 1,
  bg: backC,
  fps: 30,
  init(p, S) {
    S.points = REST.map((a) => makePoint(p, a));
    S.added = []; // [pointA, pointB] per click, oldest first
    S.quiet = 0; // seconds since the last click
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
  },
  frame(p, S) {
    const c = S.cycle.step(S.dt);

    // added lines: grow in, and once clicks stop, fade out newest first
    S.quiet += S.dt;
    let busy = false;
    for (const pt of S.points) {
      if (pt.grow !== 0) {
        pt.size = Math.min(1, Math.max(0, pt.size + (pt.grow * S.dt) / (pt.grow > 0 ? GROW : FADE)));
        if ((pt.grow > 0 && pt.size === 1) || (pt.grow < 0 && pt.size === 0)) pt.grow = 0;
        else busy = true;
      }
    }
    const gone = new Set(S.points.filter((pt) => pt.size === 0));
    if (gone.size) {
      S.points = S.points.filter((pt) => !gone.has(pt));
      S.added = S.added.filter(([a]) => !gone.has(a));
    }
    const fading = S.added.some(([a]) => a.grow < 0);
    let nextDrain = Infinity;
    if (S.added.length && !fading) {
      const due = Math.max(QUIET - S.quiet, S.drainAt - S.quiet || 0);
      if (due <= 0) {
        for (const pt of S.added[S.added.length - 1]) pt.grow = -1;
        S.drainAt = S.quiet + FADE + DRAIN;
        busy = true;
      } else nextDrain = due;
    }

    for (const pt of S.points) {
      if (c.phase === 'leave' || c.phase === 'away') {
        const rate = c.phase === 'leave' ? c.k : 1;
        pt.v = p.map(p.noise(pt.xoff), 0, 1, -DRIFT, DRIFT) * rate;
        pt.a += pt.v * S.dt;
        pt.xoff += pt.xinc * NOISE * rate * S.dt;
      } else if (c.phase === 'back') {
        if (c.turned) pt.home = coastTo(pt.a, pt.v, pt.rest, BACK);
        pt.a = pt.home(c.u);
      } else {
        pt.a = pt.rest;
      }
      pt.x = r * Math.cos(pt.a);
      pt.y = r * Math.sin(pt.a);
    }

    p.translate(S.ow / 2, S.oh / 2);
    p.background(backC);

    p.noFill();
    p.strokeWeight(CHORD_W);
    for (const [a, b] of bestPairs(S.points)) {
      p.stroke(lineC, 255 * Math.min(a.size, b.size));
      p.line(a.x, a.y, b.x, b.y);
    }

    p.noStroke();
    p.fill(lineC);
    for (const pt of S.points) p.ellipse(pt.x, pt.y, pointD * pt.size, pointD * pt.size);

    p.noFill();
    p.stroke(lineC);
    p.strokeWeight(RING_W);
    p.ellipse(0, 0, r * 2, r * 2);
    if (c.phase === 'hold' && !busy) S.sleep(Math.min(c.left, nextDrain));
  },
  mousePressed(p, S) {
    S.quiet = 0;
    S.drainAt = 0;
    if (S.points.length >= maxPoints) return;
    const a = Math.atan2(S.mouseY - S.oh / 2, S.mouseX - S.ow / 2);
    const pair = [makePoint(p, a, 0), makePoint(p, a + Math.PI + p.random(-0.6, 0.6), 0)];
    for (const pt of pair) pt.grow = 1;
    S.points.push(...pair);
    S.added.push(pair);
  },
});
