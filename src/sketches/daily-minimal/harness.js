// Shared frame for the Daily Minimal ports.
//
// Each piece was composed for a small fixed canvas (400-800px). The harness
// keeps that composition intact: the original canvas is scaled to fit the
// screen (FIT of the limiting dimension), centered, clipped to its own bounds,
// and the rest of the screen is filled with the piece's background color, so
// the port draws in the original coordinate system unchanged.
//
// spec: {
//   ow, oh        original canvas size
//   bg            background (p5 color args, e.g. 239 or [22])
//   fps           original frameRate (default 60)
//   init(p, S)    once, like setup()
//   frame(p, S)   every frame, like draw(), in original coordinates
//   resize(p, S)  optional
//   onActivate(p, S) optional, each time the piece is shown again
//   ...handlers   mousePressed/mouseReleased/keyPressed/keyReleased(p, S)
// }
// S: { ow, oh, k, mouseX, mouseY, live } - mouse is mapped into original
//   coordinates; `live` is true while someone is actually using the page.

export const FIT = 0.74;

export function dmSketch(spec) {
  return (p) => {
    const S = { ow: spec.ow, oh: spec.oh, k: 1, ox: 0, oy: 0, mouseX: 0, mouseY: 0, live: false };
    const bg = [].concat(spec.bg);

    function layout() {
      S.k = Math.min(p.width / S.ow, p.height / S.oh) * FIT;
      S.ox = (p.width - S.ow * S.k) / 2;
      S.oy = (p.height - S.oh * S.k) / 2;
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
      p.translate(S.ox, S.oy);
      p.scale(S.k);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, S.ow, S.oh);
      ctx.clip();
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
