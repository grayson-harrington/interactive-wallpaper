// S02-401 lines through circle
// Light bars accelerate across a dark paper disc. The original pointed the
// flow away from the mouse; in ambient mode the direction turns slowly.
import { dmSketch } from './harness.js';
import { dotPaperCanvas } from '../../lib/paper.js';

// half the original speed; bars spawn half as often to keep their spacing
const speed = 0.5;
const gap = 20;
const circleWidth = 300;
const start = -circleWidth / 2;
const stop = circleWidth / 2 + 50;
const rectColor = 239;
const backgroundColor = 43;

export default dmSketch({
  ow: 500,
  oh: 500,
  art: [100, 100, 300, 300], // the circle
  scale: 1,
  bg: rectColor,
  fps: 30,
  init(p, S) {
    // paper(background, 100, 50): gray 100±10 dots at alpha 50±5
    S.background = dotPaperCanvas(S.ow, S.oh, {
      base: backgroundColor,
      gray: [90, 110],
      alpha: [45, 55],
      soft: true,
    });
    S.positions = [start];
    S.angle = Math.PI / 4;
    S.frame = 0;
  },
  frame(p, S) {
    const { ow: width, oh: height } = S;
    S.frame++;
    p.drawingContext.drawImage(S.background, 0, 0);
    p.translate(width / 2, height / 2);

    if (S.live) {
      const target = Math.atan2(S.mouseY - height / 2, S.mouseX - width / 2);
      // ease toward the mouse, taking the short way around
      const diff = Math.atan2(Math.sin(target - S.angle), Math.cos(target - S.angle));
      S.angle += diff * 0.3;
    } else {
      S.angle += 0.0035;
    }
    p.rotate(S.angle - Math.PI);

    p.rectMode(p.CENTER);
    for (let i = S.positions.length - 1; i >= 0; i--) {
      p.fill(rectColor);
      p.noStroke();
      const pos = S.positions[i];
      const w = p.map(pos, start, stop, 1, 25);
      if (pos > stop) {
        S.positions.splice(i, 1);
        continue;
      }
      p.rect(pos, 0, w, 400);
      S.positions[i] = pos + speed * Math.pow(p.map(pos, start, stop, 1, 2), 6);
    }
    if (S.frame % gap === 0) S.positions.push(start);

    p.noFill();
    p.strokeWeight(300);
    p.stroke(rectColor);
    p.ellipse(0, 0, circleWidth + 300, circleWidth + 300);
  },
});
