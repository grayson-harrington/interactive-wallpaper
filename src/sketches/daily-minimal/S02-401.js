// S02-401 lines through circle
// Light bars stream across a dark paper disc, speeding up and widening as
// they go. The bars sit at geometric spacing, measured from the original, so
// when each has moved into the next one's place the image is the original
// again. After a 15s hold the flow eases into motion while its direction
// slowly turns, then coasts to a stop back on the original. With someone at
// the page, the flow points away from the mouse, as in the original.
import { dmSketch, restCycle, coastTo } from './harness.js';
import { dotPaperCanvas } from '../../lib/paper.js';

const circleWidth = 300;
const rectColor = 239;
const backgroundColor = 43;
const TAU = Math.PI * 2;

// Bars, measured from the original: bar n sits at A + B * R^n along the flow
// (from the disc's center) and is W0 * RW^n wide.
const A = -160.5;
const B = 15.7;
const R = 1.593;
const W0 = 2.75;
const RW = 1.36;
const FIRST = -2; // bars from here on, in index steps; earlier ones are off the disc
const LAST = 7;
// the flow points up and to the right, 44 degrees above horizontal
const REST_ANGLE = Math.PI - (44 * Math.PI) / 180;

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6;
const AWAY = 26;
const BACK = 7;
const FLOW = 1.5; // bar steps per second
const TURN = 0.105; // radians per second while ambient
const FOLLOW = 3; // per second, turning toward the mouse

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
    S.phase = 0; // bar steps flowed; whole numbers are the original
    S.angle = REST_ANGLE;
    S.cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });
    S.wasLive = false;
  },
  frame(p, S) {
    const { ow: width, oh: height } = S;
    const c = S.cycle;
    if (S.live) {
      S.phase += FLOW * S.dt;
      // point the flow away from the mouse, taking the short way around
      const target = Math.atan2(S.mouseY - height / 2, S.mouseX - width / 2);
      const diff = Math.atan2(Math.sin(target - S.angle), Math.cos(target - S.angle));
      S.angle += diff * (1 - Math.exp(-FOLLOW * S.dt));
    } else {
      if (S.wasLive) c.toRest(BACK);
      else c.step(S.dt);
      if (c.phase === 'leave' || c.phase === 'away') {
        const rate = c.phase === 'leave' ? c.k : 1;
        S.phase += FLOW * rate * S.dt;
        S.angle += TURN * rate * S.dt;
      } else if (c.phase === 'back') {
        if (c.turned) {
          // coast to a whole step (as an angle, one step per turn) and to the rest direction
          S.homePhase = coastTo(S.phase * TAU, FLOW * TAU, 0, BACK);
          S.homeAngle = coastTo(S.angle, S.wasLive ? 0 : TURN, REST_ANGLE, BACK);
        }
        S.phase = S.homePhase(c.u) / TAU;
        S.angle = S.homeAngle(c.u);
      } else {
        S.phase = 0;
        S.angle = REST_ANGLE;
      }
    }
    S.wasLive = S.live;

    p.drawingContext.drawImage(S.background, 0, 0);
    p.translate(width / 2, height / 2);
    p.rotate(S.angle - Math.PI);
    p.rectMode(p.CENTER);
    p.fill(rectColor);
    p.noStroke();
    const f = S.phase - Math.floor(S.phase);
    for (let n = FIRST; n <= LAST; n++) {
      const s = n + f;
      p.rect(A + B * Math.pow(R, s), 0, W0 * Math.pow(RW, s), 400);
    }

    p.noFill();
    p.strokeWeight(300);
    p.stroke(rectColor);
    p.ellipse(0, 0, circleWidth + 300, circleWidth + 300);
    if (!S.live && c.phase === 'hold') S.sleep(c.left);
  },
});
