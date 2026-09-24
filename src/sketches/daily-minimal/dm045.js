// dm045 waves through circle
// Two sine waves scroll through a ring; a small hollow circle rides each wave.
import { dmSketch } from './harness.js';

const back = 237;

export default dmSketch({
  ow: 400,
  oh: 400,
  bg: back,
  init(p, S) {
    // y(t) = A*sin(TWO_PI*f*t+p): [amplitude, frequency, phase]
    S.wave1 = [15, 0.004, 30];
    S.wave2 = [18, 0.005, 15];
    // [t, deltat, strokeWeight, diameter]; random(width) ran before size(), so width was 100
    S.circ1 = [p.random(100), p.random(0.5, 1), 3, 10];
    S.circ2 = [p.random(100), p.random(0.5, 1), 3, 15];
    S.frame = 0;
  },
  frame(p, S) {
    const width = S.ow;
    const height = S.oh;
    S.frame++;
    p.background(back);

    p.push();
    p.translate(width / 2, height / 2);
    p.rotate(Math.PI / 8);
    p.strokeWeight(6);
    p.stroke(0);
    p.noFill();
    p.ellipse(0, 0, 150, 150);
    drawWave(p, S, S.wave1, 2, S.circ1, 35);
    drawWave(p, S, S.wave2, 4, S.circ2, 30);
    p.pop();

    p.fill(back);
    p.noStroke();
    p.rectMode(p.CORNERS);
    const rWidth = Math.floor(width / 6);
    p.rect(0, 0, rWidth, height);
    p.rect(0, 0, width, rWidth);
    p.rect(0, height, width, height - rWidth);
    p.rect(width, 0, width - rWidth, height);
  },
});

function drawWave(p, S, wave, sw, circ, yoff) {
  const width = S.ow;
  const step = 10;
  const factor = 1.5;
  let prev = null;
  p.stroke(0);
  p.strokeWeight(sw);
  const offset = S.frame * factor;
  for (let t = offset; t < width + offset + step; t += step) {
    const y = wave[0] * Math.sin(Math.PI * 2 * wave[1] * t + wave[2]);
    const curr = [t - width / 2, y];
    if (prev) p.line(prev[0] - offset, prev[1] + yoff, curr[0] - offset, curr[1] + yoff);
    prev = curr;
  }

  p.strokeWeight(circ[2]);
  p.fill(back);
  const t = circ[0];
  circ[0] += circ[1];
  if (t - offset < 0) circ[0] = width + offset;
  p.ellipse(t - width / 2 - offset, wave[0] * Math.sin(Math.PI * 2 * wave[1] * t + wave[2]) + yoff, circ[3], circ[3]);
}
