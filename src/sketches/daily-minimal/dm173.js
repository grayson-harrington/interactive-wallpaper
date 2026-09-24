// dm173 max line segments
// Points drift around a circle; every frame they are paired up so the total
// length of the connecting chords is as large as possible.
// Keys: UP adds two points, DOWN removes two, P pauses.
import { dmSketch } from './harness.js';

const lineC = 239;
const backC = 45;
const pointD = 10;
const r = 200;
const minPoints = 2;
const maxPoints = 12;

function makePoint(p) {
  const pt = { xoff: p.random(10000), xinc: p.random(0.0005, 0.0008), a: p.random(0, Math.PI * 2) };
  pt.x = r * Math.cos(pt.a);
  pt.y = r * Math.sin(pt.a);
  return pt;
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
  bg: backC,
  init(p, S) {
    p.randomSeed(500);
    S.points = Array.from({ length: 6 }, () => makePoint(p));
    S.paused = false;
  },
  frame(p, S) {
    p.translate(S.ow / 2, S.oh / 2);
    p.background(backC);

    p.noFill();
    p.stroke(lineC);
    p.strokeWeight(pointD / 2);
    for (const [a, b] of bestPairs(S.points)) p.line(a.x, a.y, b.x, b.y);

    for (const pt of S.points) {
      p.noStroke();
      p.fill(lineC);
      p.ellipse(pt.x, pt.y, pointD, pointD);
      if (!S.paused) {
        pt.a += p.map(p.noise(pt.xoff), 0, 1, -Math.PI / 400, Math.PI / 400);
        pt.xoff += pt.xinc;
        pt.x = r * Math.cos(pt.a);
        pt.y = r * Math.sin(pt.a);
      }
    }

    p.noFill();
    p.stroke(lineC);
    p.strokeWeight(pointD / 2);
    p.ellipse(0, 0, r * 2, r * 2);
  },
  keyReleased(p, S) {
    if (p.keyCode === p.UP_ARROW && S.points.length < maxPoints) S.points.push(makePoint(p), makePoint(p));
    if (p.keyCode === p.DOWN_ARROW && S.points.length > minPoints) S.points.splice(0, 2);
    if (p.key === 'p') S.paused = !S.paused;
  },
});
