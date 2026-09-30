// Ambient / interactive / settle lifecycle for a piece whose look is a small
// vector of numbers (the pose). Rest is the original.
//
//   ambient   after `hold` seconds on the original, one eased excursion of
//             `away` seconds (restCycle); ambient(c, pose) writes the pose
//             for cycle state c (c.u, c.k are progress and eased progress).
//   live      while someone is at the page, live(S, pose, dt) moves the pose
//             (usually easing toward something the cursor picks).
//   settle    when they leave, the pose eases back to rest over `settle`
//             seconds (restFor(pose) can name a nearer equivalent rest, e.g.
//             the next whole step of a looping flow), then holds again.
//
// step(S) returns the pose and whether the piece is now holding still.
import { restCycle } from './harness.js';

const smooth = (t) => t * t * (3 - 2 * t);

export function pose({ rest, hold = 15, away, settle = 6, ambient, live, restFor }) {
  const cur = rest.slice();
  let c = restCycle({ hold, away });
  let mode = 'ambient';
  let t = 0;
  let from = null;
  let to = rest;
  return {
    step(S) {
      const dt = S.dt;
      if (S.live) {
        mode = 'live';
        live(S, cur, dt);
      } else if (mode === 'live') {
        mode = 'settle';
        t = 0;
        from = cur.slice();
        to = restFor ? restFor(from) : rest;
      }
      if (mode === 'settle') {
        t = Math.min(1, t + dt / settle);
        const k = smooth(t);
        for (let i = 0; i < cur.length; i++) cur[i] = from[i] + (to[i] - from[i]) * k;
        if (t >= 1) {
          for (let i = 0; i < cur.length; i++) cur[i] = rest[i];
          mode = 'ambient';
          c = restCycle({ hold, away });
        }
      } else if (mode === 'ambient') {
        c.step(dt);
        if (c.phase === 'hold') for (let i = 0; i < cur.length; i++) cur[i] = rest[i];
        else ambient(c, cur);
      }
      const still = mode === 'ambient' && c.phase === 'hold';
      return { pose: cur, still, left: c.left };
    },
  };
}
