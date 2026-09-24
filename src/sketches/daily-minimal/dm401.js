// dm401 lines through circle
// Light bars accelerate across a dark paper disc. The original pointed the
// flow away from the mouse; in ambient mode the direction turns slowly.
import { dmSketch } from './harness.js';

const gap = 10;
const circleWidth = 300;
const start = -circleWidth / 2;
const stop = circleWidth / 2 + 50;
const rectColor = 239;
const backgroundColor = 43;

function paperBackground(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${backgroundColor},${backgroundColor},${backgroundColor})`;
  ctx.fillRect(0, 0, w, h);
  // paper(background, 100, 50, ...): area/5 random 1px dots
  for (let n = 0; n < (w * h) / 5; n++) {
    const g = Math.round(100 + (Math.random() * 20 - 10));
    ctx.fillStyle = `rgba(${g},${g},${g},${(50 + (Math.random() * 10 - 5)) / 255})`;
    ctx.fillRect(Math.random() * w - 0.5, Math.random() * h - 0.5, 1, 1);
  }
  return c;
}

export default dmSketch({
  ow: 500,
  oh: 500,
  bg: rectColor,
  fps: 30,
  init(p, S) {
    S.background = paperBackground(S.ow, S.oh);
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
      S.positions[i] = pos + Math.pow(p.map(pos, start, stop, 1, 2), 6);
    }
    if (S.frame % gap === 0) S.positions.push(start);

    p.noFill();
    p.strokeWeight(300);
    p.stroke(rectColor);
    p.ellipse(0, 0, circleWidth + 300, circleWidth + 300);
  },
});
