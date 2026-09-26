// S02-446 controlled noise
// Five noisy rings drawn on top of each other. The noise only shows up near
// the mouse; in ambient mode a slowly wandering point stands in for it.
// Keys: UP adds a ring, DOWN removes one.
import { dmSketch, wanderer } from './harness.js';

const backC = 22;
const lineC = 246;
const maxDoff = 100;

// Processing's constrain (low wins over high when they cross)
const constrain = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function noiseCircle(zoff) {
  return { cx: 250, cy: 250, d: 300, numPoints: 400, zoff, zinc: 0.007, noiseMax: 0.5 };
}

export default dmSketch({
  ow: 500,
  oh: 500,
  art: [100, 100, 300, 300], // the circle
  scale: 1,
  bg: backC,
  init(p, S) {
    S.circles = Array.from({ length: 5 }, (_, i) => noiseCircle(i * 5));
    S.wander = wanderer(p, 250, 250, 210, 0.0035);
  },
  frame(p, S) {
    p.background(backC);
    const [mx, my] = S.live ? [S.mouseX, S.mouseY] : S.wander();
    p.stroke(lineC);
    p.strokeWeight(1);
    p.noFill();
    for (const nc of S.circles) {
      const distEffect = p.map(Math.hypot(mx - nc.cx, my - nc.cy), 0, nc.d / 2, nc.d / 2 + 20, 100);
      p.beginShape();
      for (let i = 0; i < nc.numPoints; i++) {
        const a = (i / nc.numPoints) * Math.PI * 2;
        const xoff = p.map(Math.cos(a), -1, 1, 0, nc.noiseMax);
        const yoff = p.map(Math.sin(a), -1, 1, 0, nc.noiseMax);
        let doff = p.map(p.noise(xoff, yoff, nc.zoff), 0, 1, -maxDoff, maxDoff);
        let dist = Math.hypot(nc.cx + (Math.cos(a) * nc.d) / 2 - mx, nc.cy + (Math.sin(a) * nc.d) / 2 - my);
        dist = constrain(dist, 0, distEffect);
        doff *= p.map(dist * dist, 0, distEffect * distEffect, 1, 0);
        p.vertex(nc.cx + (nc.d / 2 + doff) * Math.cos(a), nc.cy + (nc.d / 2 + doff) * Math.sin(a));
      }
      p.endShape(p.CLOSE);
      nc.zoff += nc.zinc;
    }
  },
  keyReleased(p, S) {
    if (p.keyCode === p.UP_ARROW && S.circles.length < 50) S.circles.push(noiseCircle(S.circles.length * 5));
    if (p.keyCode === p.DOWN_ARROW && S.circles.length > 0) S.circles.shift();
  },
});
