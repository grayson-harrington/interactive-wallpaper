// S02-474 popup lines
// Fifty random lines inside a circle; twice a second the oldest disappears
// and a new one pops up.
import { dmSketch } from './harness.js';

const backC = 239;
const lineC = 15;
const numLines = 50;

export default dmSketch({
  ow: 500,
  oh: 500,
  art: [125, 125, 250, 250], // the circular window the lines show through
  scale: 1,
  bg: backC,
  fps: 2,
  init(p, S) {
    const r = () => [p.random(S.ow), p.random(S.oh)];
    S.newLine = () => [...r(), ...r()];
    S.lines = Array.from({ length: numLines }, S.newLine);
  },
  frame(p, S) {
    p.background(backC);
    for (const [x1, y1, x2, y2] of S.lines) {
      p.strokeWeight(6);
      p.stroke(backC);
      p.line(x1, y1, x2, y2);
      p.strokeWeight(3);
      p.stroke(lineC);
      p.line(x1, y1, x2, y2);
    }
    S.lines.shift();
    S.lines.push(S.newLine());

    p.noFill();
    p.stroke(backC);
    p.strokeWeight(250);
    p.ellipse(S.ow / 2, S.oh / 2, 500, 500);
  },
});
