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
//   fps           original frameRate (default 60)
//   init(p, S)    once, like setup()
//   frame(p, S)   every frame, like draw(), in original coordinates
//   resize(p, S)  optional
//   onActivate(p, S) optional, each time the piece is shown again
//   ...handlers   mousePressed/mouseReleased/keyPressed/keyReleased(p, S)
// }
// S: { ow, oh, scale, k, mouseX, mouseY, live } - mouse is mapped into original
//   coordinates; `live` is true while someone is actually using the page.

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
      p.frameRate(spec.fps ?? 60);
      layout();
      spec.init?.(p, S);
    };

    p.draw = () => {
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
export function wanderer(p, cx, cy, radius, speed = 0.004, seed = Math.random() * 1000) {
  let t = 0;
  return () => {
    t += speed;
    const r = radius * (0.35 + 0.65 * p.noise(seed + t * 0.7));
    const a = p.noise(seed + 100 + t * 0.35) * Math.PI * 4;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
}
