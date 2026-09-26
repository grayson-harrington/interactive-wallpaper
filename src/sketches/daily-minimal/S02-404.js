// S02-404 rotating concentric circles
// Three sets of alternating bands, each rotating and carried around by the
// one outside it.
import { dmSketch } from './harness.js';

const light = 238;
const dark = 35;

function circle(x, y, d, bandThickness, numBands) {
  return { x, y, d, bandThickness, numBands, a: 0, ainc: 2 / d, dist: 0 };
}

export default dmSketch({
  ow: 700,
  oh: 700,
  art: [100, 100, 500, 500], // the outer circle
  scale: 1,
  bg: light,
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
  },
  frame(p, S) {
    p.background(light);
    p.noStroke();
    S.circs.forEach((c, i) => {
      p.push();
      p.translate(c.x, c.y);
      p.rotate(c.a);
      for (let b = 0; b <= c.numBands; b++) {
        p.fill(b % 2 === 0 ? dark : light);
        p.ellipse(c.bandThickness * b - (c.bandThickness * b) / 2, 0, c.d - c.bandThickness * b, c.d - c.bandThickness * b);
      }
      p.pop();
      c.a += c.ainc;
      if (i !== 0) {
        const parent = S.circs[i - 1];
        c.x = parent.x + c.dist * Math.cos(parent.a);
        c.y = parent.y + c.dist * Math.sin(parent.a);
      }
    });
  },
});
