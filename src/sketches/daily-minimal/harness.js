// Shared frame for the Daily Minimal ports.
//
// Each piece draws in its original canvas coordinates (ow x oh), unchanged.
// The harness sizes every piece the same way on screen: the rest-pose bounds
// of its main form (`art`) are scaled so their equal-area side, sqrt(w*h), is
// SIZE of the shorter screen side (times the piece's own `scale`), and that
// box is centered. Drawing is clipped to the original canvas, and the rest of
// the screen is filled with the piece's background color.
// ?native=1 draws at scale 1 with the canvas centered, for 1:1 fidelity shots.
//
// spec: {
//   ow, oh        original canvas size
//   art           [x, y, w, h] rest-pose bounds of the main form (default: canvas)
//   scale         per-piece size tuning, multiplies SIZE (default 1)
//   bg            background (p5 color args, e.g. 239 or [22])
//   fps           frame rate (default 30)
//   init(p, S)    once, like setup()
//   frame(p, S)   every frame, like draw(), in original coordinates
//   resize(p, S)  optional
//   onActivate(p, S) optional, each time the piece is shown again
//   ...handlers   mousePressed/mouseReleased/keyPressed/keyReleased(p, S)
// }
// S: { ow, oh, scale, k, mouseX, mouseY, live, dt } - mouse is mapped into
//   original coordinates; `live` is true while someone is actually using the
//   page; dt is seconds since the last frame (capped at 0.1, except after a
//   sleep, when it is the whole time asleep).
// S.sleep(secs) at the end of frame() stops drawing for a still hold. The piece
//   wakes after secs (Infinity: only on input), on any input, when the page goes
//   idle, and when it is shown again.

import { onInput, msSinceInput, DEFAULT_IDLE_MS } from '../../lib/interaction.js';

export const SIZE = 0.5;

const native = new URLSearchParams(location.search).get('native') === '1';

export function dmSketch(spec) {
  return (p) => {
    const S = { ow: spec.ow, oh: spec.oh, scale: spec.scale ?? 1, k: 1, ox: 0, oy: 0, mouseX: 0, mouseY: 0, live: false };
    const bg = [].concat(spec.bg);

    const [ax, ay, aw, ah] = spec.art ?? [0, 0, spec.ow, spec.oh];

    function layout() {
      if (native) {
        S.k = 1;
        S.ox = (p.width - S.ow) / 2;
        S.oy = (p.height - S.oh) / 2;
        return;
      }
      const { width: W, height: H } = p;
      // equal-area sizing, capped so very wide or tall art still fits
      S.k = Math.min((SIZE * S.scale * Math.min(W, H)) / Math.sqrt(aw * ah), (0.9 * W) / aw, (0.9 * H) / ah);
      S.ox = W / 2 - (ax + aw / 2) * S.k;
      S.oy = H / 2 - (ay + ah / 2) * S.k;
    }

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.frameRate(spec.fps ?? 30);
      layout();
      spec.init?.(p, S);
    };

    // still holds: see S.sleep above
    let last = 0;
    let asleep = false;
    let timer = null;
    S.sleep = (secs) => {
      S.sleepFor = secs;
    };
    onInput(() => {
      if (asleep && p.isActive?.()) p.loop();
    });
    function sleep(secs) {
      asleep = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      let ms = secs * 1000;
      // while live, wake in time to notice the page going idle
      const since = msSinceInput();
      if (S.live && since < DEFAULT_IDLE_MS) ms = Math.min(ms, DEFAULT_IDLE_MS - since + 50);
      if (Number.isFinite(ms)) timer = p.schedule(() => p.loop(), Math.max(0, ms));
      p.noLoop();
    }

    p.draw = () => {
      const now = performance.now();
      S.dt = Math.min((now - last) / 1000, asleep ? 3600 : 0.1);
      last = now;
      asleep = false;
      S.sleepFor = 0;
      S.live = p.interactive();
      S.mouseX = (p.mouseX - S.ox) / S.k;
      S.mouseY = (p.mouseY - S.oy) / S.k;

      p.background(...bg);
      const ctx = p.drawingContext;
      p.push();
      ctx.save();
      // clip to the original canvas, snapped to device pixels: a soft clip edge
      // leaves seams where a piece masks its own drawing with the background
      const d = p.pixelDensity();
      const snap = (v) => Math.round(v * d) / d;
      const [x0, y0] = [snap(S.ox), snap(S.oy)];
      ctx.beginPath();
      ctx.rect(x0, y0, snap(S.ox + S.ow * S.k) - x0, snap(S.oy + S.oh * S.k) - y0);
      ctx.clip();
      p.translate(S.ox, S.oy);
      p.scale(S.k);
      spec.frame(p, S);
      ctx.restore();
      p.pop();
      if (S.sleepFor > 0) sleep(S.sleepFor);
    };

    p.windowResized = () => {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      layout();
      spec.resize?.(p, S);
    };

    p.onActivate = () => spec.onActivate?.(p, S);

    for (const name of ['mousePressed', 'mouseReleased', 'keyPressed', 'keyReleased']) {
      if (spec[name]) {
        p[name] = (e) => {
          S.mouseX = (p.mouseX - S.ox) / S.k;
          S.mouseY = (p.mouseY - S.oy) / S.k;
          return spec[name](p, S, e);
        };
      }
    }
  };
}

// A slowly wandering stand-in for the mouse (ambient mode), in original coords.
// Call it once per frame; speed is in noise units per second.
export function wanderer(p, cx, cy, radius, speed = 0.12, seed = Math.random() * 1000) {
  let t = 0;
  return () => {
    t += (speed * Math.min(p.deltaTime, 100)) / 1000;
    const r = radius * (0.35 + 0.65 * p.noise(seed + t * 0.7));
    const a = p.noise(seed + 100 + t * 0.35) * Math.PI * 4;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
}

const smooth = (t) => t * t * (3 - 2 * t);

// Ambient pacing (README, "Pacing"): hold on the original, leave, stay away,
// come back, hold again. Durations are in seconds. With leave and back left at
// 0, `away` is one eased excursion that leaves and returns by itself.
// Call step(dt) once per frame, then read:
//   phase   'hold' | 'leave' | 'away' | 'back'
//   u, k    linear and eased progress through the phase, 0..1
//   left    seconds until the phase ends (for p.schedule during a still hold)
//   turned  true on the frame a new phase began
// toRest(secs) starts an eased return from wherever the piece is (e.g. when
// input stops); skip() ends the current phase now (e.g. from a scheduled wake).
export function restCycle({ hold, leave = 0, away, back = leave }) {
  const len = { hold, leave, away, back };
  const next = { hold: leave ? 'leave' : 'away', leave: 'away', away: back ? 'back' : 'hold', back: 'hold' };
  const c = { phase: 'hold', t: 0, dur: hold, u: 0, k: 0, left: hold, turned: false };
  const enter = (phase, dur = len[phase]) => {
    c.phase = phase;
    c.t = 0;
    c.dur = dur;
    c.turned = true;
  };
  const update = () => {
    c.u = Math.min(1, c.t / c.dur);
    c.k = smooth(c.u);
    c.left = Math.max(0, c.dur - c.t);
    return c;
  };
  c.step = (dt) => {
    c.turned = false;
    c.t += dt;
    if (c.t >= c.dur) enter(next[c.phase]);
    return update();
  };
  c.skip = () => {
    enter(next[c.phase]);
    return update();
  };
  c.toRest = (secs = back || 6) => {
    enter('back', secs);
    return update();
  };
  return c;
}

// Eases a turning angle to a stop on `rest` (mod 2pi): from angle a turning at
// w rad/s, returns f(u), u in 0..1 over `secs`, that starts at a with speed w,
// arrives on a rest angle with zero speed, and never turns back.
export function coastTo(a, w, rest, secs) {
  const TAU = Math.PI * 2;
  const s = w < 0 ? -1 : 1;
  const v = Math.abs(w) * secs; // entry speed, in angle per unit u
  // the first rest angle at least v/3 ahead keeps the curve monotonic
  let d = (((s * (rest - a) - v / 3) % TAU) + TAU) % TAU + v / 3;
  return (u) => a + s * (v * (u - 2 * u * u + u * u * u) + d * (3 * u * u - 2 * u * u * u));
}
