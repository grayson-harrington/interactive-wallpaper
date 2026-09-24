// Bicycle Galaxy  (new build; loosely after Processing Round 6/bicycle_galaxy)
//
// "Orbital zoom" visualizations show how a point traces a path in one frame
// of reference (Earth around the Sun, the Sun around the galactic center...).
// This does the same for the rotating parts of a stationary bicycle: one
// tracked point on each moving component leaves a fading trail showing the
// path it traces.
//   both wheel rims, the front axle, the bottom bracket axle (where the
//   pedal cranks pass through the frame), a chainring tooth, the pedal and a
//   chain link (whose path around chainring + cog is a "stadium" loop)
// Everything is driven by one crank angle; the chain moves at
// crank speed x chainring radius, so the cog and wheels turn at the gear
// ratio (44/16-ish). The original's Rotator (point around a center) and
// RotatorGroup (tangent-line chain path) ideas are reused, rebuilt as closed
// form functions of the crank angle so trails are just resampled each frame:
// nothing accumulates.

const TAU = Math.PI * 2;

// geometry in wheel-radius units, y down, bike facing right
const RH = [-1.55, 0]; // rear hub
// the front wheel sits far enough forward that its tire clears the head tube
// and down tube (a real fork's rake/trail), rather than overlapping them
const FH = [1.82, 0]; // front hub
const BB = [-0.25, 0.22]; // bottom bracket
const ST = [-0.62, -1.2]; // seat tube top
const HT = [0.98, -1.12]; // head tube top
const HB = [1.08, -0.8]; // head tube bottom
const R_WHEEL = 1;
const R_RIM = 0.9;
const R_RING = 0.28;
const R_COG = 0.11;
const CRANK = 0.46;
const RATIO = R_RING / R_COG;
const R_HUB = 0.07; // wheel hub shell (drawn circle)
const R_BB = 0.045; // bottom bracket shell

const CRANK_SECONDS = 16; // one pedal revolution
const FPS = 30;

// external tangent between the chainring (c1) and cog (c2), top and bottom
function chainPath() {
  const [x1, y1] = BB;
  const [x2, y2] = RH;
  const d = Math.hypot(x2 - x1, y2 - y1);
  const phi = Math.atan2(y2 - y1, x2 - x1);
  const beta = Math.acos((R_RING - R_COG) / d);
  const cands = [phi + beta, phi - beta].map((a) => ({
    a,
    ring: [x1 + R_RING * Math.cos(a), y1 + R_RING * Math.sin(a)],
    cog: [x2 + R_COG * Math.cos(a), y2 + R_COG * Math.sin(a)],
  }));
  const [top, bottom] = cands.sort((m, n) => m.ring[1] - n.ring[1]);
  const mod = (a) => ((a % TAU) + TAU) % TAU;

  // clockwise on screen = increasing angle (y down)
  const ringArc = mod(bottom.a - top.a); // ring: top -> right side -> bottom
  const cogArc = mod(top.a - bottom.a); // cog: bottom -> left side -> top
  const bottomLen = Math.hypot(bottom.cog[0] - bottom.ring[0], bottom.cog[1] - bottom.ring[1]);
  const topLen = Math.hypot(top.ring[0] - top.cog[0], top.ring[1] - top.cog[1]);
  const segs = [ringArc * R_RING, bottomLen, cogArc * R_COG, topLen];
  const length = segs.reduce((a, b) => a + b, 0);

  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  function at(s) {
    s = ((s % length) + length) % length;
    if (s < segs[0]) {
      const a = top.a + s / R_RING;
      return [x1 + R_RING * Math.cos(a), y1 + R_RING * Math.sin(a)];
    }
    s -= segs[0];
    if (s < segs[1]) return lerp(bottom.ring, bottom.cog, s / segs[1]);
    s -= segs[1];
    if (s < segs[2]) {
      const a = bottom.a + s / R_COG;
      return [x2 + R_COG * Math.cos(a), y2 + R_COG * Math.sin(a)];
    }
    s -= segs[2];
    return lerp(top.cog, top.ring, s / segs[3]);
  }
  return { at, length };
}

const chain = chainPath();

const orbit = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];

// Tracked points, as positions in the bike's frame for a given crank angle.
// The bike is drawn standing still, but its trails are laid down in the
// road's frame: every trail sample is shifted back by how far the bike has
// rolled since (wheel speed x rim radius), so trails stream off the left edge
// as if the bike were riding forward - rim and hub points trace cycloids
// (shallow ones for the hubs), the pedal traces a stretched loop.
const TRACKS = [
  { name: 'front rim', color: [111, 168, 255], pos: (t) => orbit(FH, R_RIM, t * RATIO + 1.1) },
  { name: 'rear rim', color: [199, 146, 234], pos: (t) => orbit(RH, R_RIM, t * RATIO + 2.3) },
  { name: 'front hub', color: [160, 220, 255], pos: (t) => orbit(FH, R_HUB, t * RATIO + 0.5) },
  { name: 'rear hub', color: [230, 190, 255], pos: (t) => orbit(RH, R_HUB, t * RATIO + 3.4) },
  { name: 'bottom bracket', color: [255, 224, 102], pos: (t) => orbit(BB, R_BB, t + 2.2) },
  { name: 'chainring tooth', color: [255, 200, 120], pos: (t) => orbit(BB, R_RING, t + 0.9) },
  { name: 'pedal', color: [127, 209, 174], pos: (t) => orbit(BB, CRANK, t) },
  { name: 'chain link', color: [255, 150, 90], pos: (t) => chain.at(t * R_RING + 0.4) },
];
const DRIFT = RATIO * R_WHEEL; // road distance per radian of crank
const SAMPLES = 400;

export default function bicycleGalaxy(p) {
  let theta = 0;
  let k = 1;
  let cx = 0;
  let cy = 0;
  const omega = TAU / (CRANK_SECONDS * FPS);

  function layout() {
    // bike bounds: x [-2.6, 2.85], y [-1.6, 1.05]
    k = Math.min(p.width / 5.7, p.height / 2.9) * 0.84;
    cx = p.width / 2 - 0.12 * k;
    cy = p.height / 2 + 0.28 * k;
  }

  const X = (v) => cx + v[0] * k;
  const Y = (v) => cy + v[1] * k;

  function drawTrail(ctx, track) {
    const [r, g, b] = track.color;
    const head = track.pos(theta);
    // long enough to leave the screen on the left
    const span = (X(head) / k + 0.4) / DRIFT;
    const at = (lag) => {
      const q = track.pos(theta - lag);
      return [q[0] - lag * DRIFT, q[1]];
    };
    // one path, one stroke, one color: no darker spots where segments overlap
    ctx.strokeStyle = `rgba(${r},${g},${b},0.85)`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= SAMPLES; i++) {
      const q = at(span * (1 - i / SAMPLES));
      if (i === 0) ctx.moveTo(X(q), Y(q));
      else ctx.lineTo(X(q), Y(q));
    }
    ctx.stroke();
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(X(head), Y(head), 4, 0, TAU);
    ctx.fill();
  }

  function line(ctx, a, b) {
    ctx.beginPath();
    ctx.moveTo(X(a), Y(a));
    ctx.lineTo(X(b), Y(b));
    ctx.stroke();
  }

  function circle(ctx, c, r) {
    ctx.beginPath();
    ctx.arc(X(c), Y(c), r * k, 0, TAU);
    ctx.stroke();
  }

  function wheel(ctx, c, angle) {
    ctx.lineWidth = Math.max(3, 0.05 * k);
    ctx.strokeStyle = 'rgba(210,214,224,0.9)';
    circle(ctx, c, R_WHEEL - 0.025);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(210,214,224,0.55)';
    circle(ctx, c, R_RIM);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(210,214,224,0.28)';
    for (let i = 0; i < 18; i++) {
      const a = angle + (i / 18) * TAU;
      line(ctx, orbit(c, R_HUB, a + 0.4), orbit(c, R_RIM, a));
    }
    ctx.strokeStyle = 'rgba(210,214,224,0.8)';
    ctx.lineWidth = 2;
    circle(ctx, c, R_HUB);
  }

  function bike(ctx) {
    const wheelAngle = theta * RATIO;
    wheel(ctx, RH, wheelAngle);
    wheel(ctx, FH, wheelAngle);

    // far-side crank + pedal
    ctx.strokeStyle = 'rgba(210,214,224,0.35)';
    ctx.lineWidth = Math.max(3, 0.045 * k);
    const farPedal = orbit(BB, CRANK, theta + Math.PI);
    line(ctx, BB, farPedal);
    line(ctx, [farPedal[0] - 0.09, farPedal[1]], [farPedal[0] + 0.09, farPedal[1]]);

    // frame
    ctx.strokeStyle = 'rgba(226,229,236,0.95)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, 0.05 * k);
    line(ctx, BB, ST); // seat tube
    line(ctx, [ST[0] + 0.03, ST[1] + 0.12], [HT[0], HT[1] + 0.06]); // top tube
    line(ctx, BB, HB); // down tube
    line(ctx, HT, HB); // head tube
    line(ctx, BB, RH); // chain stay
    line(ctx, [ST[0] + 0.02, ST[1] + 0.1], RH); // seat stay
    // fork: straight down the steering axis, then raked forward to the hub
    line(ctx, HB, [HB[0] + 0.25, HB[1] + 0.52]);
    ctx.beginPath();
    ctx.moveTo(X([HB[0] + 0.25, HB[1] + 0.52]), Y([HB[0] + 0.25, HB[1] + 0.52]));
    ctx.quadraticCurveTo(X([HB[0] + 0.36, HB[1] + 0.78]), Y([HB[0] + 0.36, HB[1] + 0.78]), X(FH), Y(FH));
    ctx.stroke();
    // seat post + saddle
    line(ctx, ST, [ST[0] - 0.06, ST[1] - 0.2]);
    ctx.lineWidth = Math.max(5, 0.075 * k);
    line(ctx, [ST[0] - 0.3, ST[1] - 0.22], [ST[0] + 0.14, ST[1] - 0.2]);
    // stem + bars
    ctx.lineWidth = Math.max(3, 0.05 * k);
    line(ctx, HT, [HT[0] - 0.04, HT[1] - 0.2]);
    ctx.beginPath();
    ctx.moveTo(X([HT[0] - 0.04, HT[1] - 0.2]), Y([HT[0] - 0.04, HT[1] - 0.2]));
    ctx.quadraticCurveTo(X([HT[0] + 0.35, HT[1] - 0.26]), Y([HT[0] + 0.35, HT[1] - 0.26]), X([HT[0] + 0.25, HT[1] + 0.02]), Y([HT[0] + 0.25, HT[1] + 0.02]));
    ctx.stroke();

    // drivetrain
    ctx.strokeStyle = 'rgba(226,229,236,0.85)';
    ctx.lineWidth = 2;
    circle(ctx, BB, R_RING);
    circle(ctx, RH, R_COG);
    for (let i = 0; i < 5; i++) line(ctx, BB, orbit(BB, R_RING, theta + (i / 5) * TAU + 0.3));
    // chain links
    ctx.fillStyle = 'rgba(226,229,236,0.7)';
    const spacing = 0.05;
    const n = Math.floor(chain.length / spacing);
    const shift = (theta * R_RING) % (chain.length / n);
    for (let i = 0; i < n; i++) {
      const q = chain.at(shift + (i * chain.length) / n);
      ctx.beginPath();
      ctx.arc(X(q), Y(q), Math.max(1.3, 0.012 * k), 0, TAU);
      ctx.fill();
    }

    // near-side crank + pedal
    ctx.strokeStyle = 'rgba(226,229,236,0.95)';
    ctx.lineWidth = Math.max(3.5, 0.05 * k);
    const pedal = orbit(BB, CRANK, theta);
    line(ctx, BB, pedal);
    ctx.lineWidth = Math.max(5, 0.07 * k);
    line(ctx, [pedal[0] - 0.1, pedal[1]], [pedal[0] + 0.1, pedal[1]]);
    ctx.fillStyle = 'rgba(226,229,236,1)';
    ctx.beginPath();
    ctx.arc(X(BB), Y(BB), R_BB * k, 0, TAU);
    ctx.fill();
  }

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(FPS);
    layout();
  };

  p.draw = () => {
    theta += omega;
    const ctx = p.drawingContext;
    p.background(12, 14, 26);
    for (const t of TRACKS) drawTrail(ctx, t);
    bike(ctx);
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    layout();
  };
}
