// Shared engine for the moon-phase rows (S02-015, S02-322).
// A row of moons, each showing one phase of a cycle that waxes from a new-moon
// ring to full and wanes back (lit on the mirrored side). After a rest on the
// original, every moon advances one phase at a time, so the sequence rolls
// along the row and comes home after a full cycle. With someone at the page,
// moving the cursor sideways scrubs the phases; when they leave, the row eases
// to the nearest step and rolls on to the original.
//
// A design supplies its measured pieces:
//   keys     phase keyframes [m, k] from the empty moon to full, lit on the
//            left (rotated by `rot`): the terminator crosses the moon's middle
//            row at x offset m and bends with signed curvature k. k > 0 cuts a
//            disc of radius 1/k out of the moon (crescent), k < 0 keeps only
//            its overlap with one (gibbous), k = 0 is a straight edge. The
//            cycle is the keys waxing, then mirrored waning.
//   xs, cy   the moons' centers in the original (also where each moon's patch
//            of paper comes from)
//   gap      { gap, mid }: slide the moons so the gaps between their visible
//            edges stay equal, the middle moon's visible center held at `mid`.
//            Leave it out to keep the centers fixed at xs.
//   q0       the phase of the first moon at rest (0 = the empty ring)
//   rot      angle the lit-left frame is turned by, radians
import { dmSketch } from './harness.js';

const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function moonRow(cfg) {
  const { R, cy, xs: XS, keys, ink, ringW, q0 = 0, rot = 0, gap } = cfg;
  const T = { hold: 15, move: 1.8, pause: 1.5, settle: 6, scrub: 110, ...cfg.timing }; // seconds; px per step
  const H = keys.length - 1;
  const STEPS = 2 * H; // waxing 0..H, then waning H..STEPS mirrored
  const N = XS.length;
  const wrap = (x) => ((x % STEPS) + STEPS) % STEPS;
  const ringAt = (q) => (q < 1 ? 1 - q : q > STEPS - 1 ? q - (STEPS - 1) : 0);

  // Terminator [m, k] and side at cycle position q in [0, STEPS).
  function phaseAt(q) {
    const mirror = q > H;
    const s = mirror ? STEPS - q : q;
    const i = Math.min(Math.floor(s), H - 1);
    const f = s - i;
    const [m0, k0] = keys[i];
    const [m1, k1] = keys[i + 1];
    return [m0 + (m1 - m0) * f, k0 + (k1 - k0) * f, mirror];
  }

  // Visible x extent [left, right] of a moon at cycle position q, relative to
  // its center, before rotating: the lit part, widened to the full disc as the
  // ring fades in. Worked out exactly from the circles, so it changes
  // smoothly with q.
  function extentAt(q) {
    const [m, k, mirror] = phaseAt(q);
    let lo = 0;
    let hi = 0;
    if (m > -R + 0.05) {
      lo = -R;
      hi = Math.min(R, m);
      if (Math.abs(k) > 1e-4) {
        // the terminator circle: center c on the axis, radius rho
        const rho = Math.abs(1 / k);
        const c = m + 1 / k;
        // x where it crosses the moon's rim, if it does
        const meet = Math.abs(R - rho) < Math.abs(c) && Math.abs(c) < R + rho ? (R * R - rho * rho + c * c) / (2 * c) : null;
        if (k > 0) {
          // crescent: the rim minus that circle; the tips are the crossings
          hi = Math.abs(R - c) < rho && meet !== null ? meet : R;
        } else if (Math.abs(-R - c) >= rho && meet !== null) {
          // gibbous: the rim within that circle; it may not reach the far side
          lo = meet;
        }
      }
    }
    if (mirror) [lo, hi] = [-hi, -lo];
    const ring = ringAt(q);
    return [lo + (-R - lo) * ring, hi + (R - hi) * ring];
  }

  // Moon centers for this frame.
  function centers(qs) {
    if (!gap) return XS;
    const ext = qs.map(extentAt);
    const xs = new Array(N);
    const mid = Math.floor(N / 2);
    xs[mid] = gap.mid - (ext[mid][0] + ext[mid][1]) / 2;
    for (let i = mid + 1; i < N; i++) xs[i] = xs[i - 1] + ext[i - 1][1] + gap.gap - ext[i][0];
    for (let i = mid - 1; i >= 0; i--) xs[i] = xs[i + 1] + ext[i + 1][0] - gap.gap - ext[i][1];
    return xs;
  }

  function drawMoon(ctx, tex, i, cx, q) {
    const [m, k, mirror] = phaseAt(q);
    if (m > -R + 0.05) {
      const base = ctx.getTransform();
      ctx.save();
      ctx.translate(cx, cy);
      if (rot) ctx.rotate(rot);
      if (mirror) ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      if (k > 1e-4) {
        ctx.rect(-R - 1, -R - 1, 2 * R + 2, 2 * R + 2);
        ctx.arc(m + 1 / k, 0, 1 / k, 0, Math.PI * 2);
        ctx.clip('evenodd');
      } else if (k < -1e-4) {
        ctx.arc(m + 1 / k, 0, -1 / k, 0, Math.PI * 2);
        ctx.clip();
      } else {
        ctx.rect(-R - 1, -R - 1, m + R + 1, 2 * R + 2);
        ctx.clip();
      }
      ctx.setTransform(base);
      // each moon carries its own patch of paper
      const [tx, ty] = tex.rect;
      ctx.drawImage(tex.canvas, XS[i] - R - 2 - tx, cy - R - 2 - ty, 2 * R + 4, 2 * R + 4, cx - R - 2, cy - R - 2, 2 * R + 4, 2 * R + 4);
      ctx.restore();
    }
    // the new moon is an outline, faded in around the empty phase
    const ring = ringAt(q);
    if (ring > 0) {
      ctx.strokeStyle = `rgba(${ink},${ink},${ink},${ring})`;
      ctx.lineWidth = ringW;
      ctx.beginPath();
      ctx.arc(cx, cy, R - ringW / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // The rest row's bounds. With sliding moons, made symmetric about the
  // middle one so the harness centers it on screen.
  const art =
    cfg.art ??
    (() => {
      const qs = XS.map((_, i) => q0 + i);
      const xs = centers(qs);
      const ext = qs.map(extentAt);
      const half = Math.max(gap.mid - (xs[0] + ext[0][0]), xs[N - 1] + ext[N - 1][1] - gap.mid);
      return [gap.mid - half, cy - R, 2 * half, 2 * R];
    })();

  function draw(p, S) {
    const ctx = p.drawingContext;
    const qs = XS.map((_, i) => wrap(q0 + i + S.pos));
    const xs = centers(qs);
    for (let i = 0; i < N; i++) drawMoon(ctx, S.tex, i, xs[i], qs[i]);
  }

  return dmSketch({
    ow: cfg.ow,
    oh: cfg.oh,
    art,
    scale: cfg.scale,
    bg: cfg.bg,
    fps: 30,
    init(p, S) {
      S.tex = cfg.tex();
      S.pos = 0; // phase steps advanced, fractional while moving
      S.state = 'hold';
      S.t = 0;
      S.armed = false;
      S.lastMouse = [NaN, NaN];
      p.mouseMoved = () => {
        if (!p.isLooping()) p.loop();
      };
    },
    frame(p, S) {
      const dt = Math.min(p.deltaTime, 100) / 1000;

      if (S.live) {
        if (S.state !== 'scrub') {
          S.state = 'scrub';
          S.anchor = [S.pos, S.mouseX];
        }
        const target = S.anchor[0] + (S.mouseX - S.anchor[1]) / T.scrub;
        S.pos += (target - S.pos) * Math.min(1, 8 * dt);
      } else if (S.state === 'scrub') {
        [S.state, S.t, S.from, S.to] = ['settle', 0, S.pos, Math.round(S.pos)];
      }

      if (S.state === 'move' || S.state === 'settle') {
        const dur = S.state === 'move' ? T.move : T.settle;
        S.t = Math.min(1, S.t + dt / dur);
        S.pos = S.from + (S.to - S.from) * smoother(S.t);
        if (S.t >= 1) {
          S.pos = wrap(S.to);
          S.state = 'hold';
          S.armed = false;
        }
      }

      draw(p, S);

      if (S.state === 'hold') {
        if (!S.armed) {
          S.armed = true;
          // rest on the original, only pause between the steps away from it
          p.schedule(
            () => {
              if (S.state !== 'hold') return;
              [S.state, S.t, S.from, S.to] = ['move', 0, S.pos, S.pos + 1];
              p.loop();
            },
            (S.pos === 0 ? T.hold : T.pause) * 1000,
          );
        }
        p.noLoop();
      } else if (S.state === 'scrub') {
        const still = S.mouseX === S.lastMouse[0] && Math.abs(S.anchor[0] + (S.mouseX - S.anchor[1]) / T.scrub - S.pos) < 1e-3;
        if (still) {
          p.noLoop();
          // look again later: input going quiet doesn't wake the sketch
          if (!S.polling) {
            S.polling = true;
            p.schedule(() => {
              S.polling = false;
              p.loop();
            }, 5000);
          }
        }
      }
      S.lastMouse[0] = S.mouseX;
      S.lastMouse[1] = S.mouseY;
    },
    onActivate(p, S) {
      S.armed = false;
      S.polling = false;
    },
  });
}
