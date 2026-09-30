// S02-322 vertical moons
// Seven black moons on a light ground, lit from the bottom on the left, full
// in the middle, lit from the top on the right. It is S02-015's moon row
// turned on its side (moons.js): after a 15s rest every moon advances one
// phase at a time, eight quick steps in about 26s, so the sequence rolls left
// along the row: the full moon wanes to a crescent, the last crescent thins to
// a ring, a new crescent grows in on the right, and after the eighth step the
// row is the original again. With someone at the page, moving the cursor
// sideways scrubs the phases; when they leave, the row eases to the nearest
// step and rolls on to the original.
import { moonRow } from './moons.js';
import { paperCanvas } from '../../lib/paper.js';

// Geometry, measured: 95px moons on y=649.5, centers 120.5px apart.
const CY = 649.5;
const XS = [278, 398.5, 519, 639.5, 760, 880.5, 1001.5];
const R = 47.5;
const RING = 4.75;
const INK = 10;

// Phase keyframes, lit on the left before the row is turned (see moons.js):
// the empty moon, three waxing phases fitted to the first three moons, full.
// The right-hand moons are these turned half a turn.
const KEYS = [
  [-47.5, 0.02105],
  [-27.6, 0.021],
  [-6.1, 0.0128],
  [32.9, -0.0182],
  [47.5, -0.02105],
];

// Timing, in seconds.
const HOLD = 15;
const MOVE = 1.8; // one phase step
const PAUSE = 1.5; // between steps
const SETTLE = 6; // to the nearest step after someone leaves
const SCRUB = 110; // px of cursor travel per phase step

// Black paper with white flecks, one patch per moon, covering the row.
const TEX = [XS[0] - R - 2, CY - R - 2, XS[6] - XS[0] + 2 * R + 4, 2 * R + 4];

function paperTexture() {
  const [, , w, h] = TEX;
  const canvas = paperCanvas(w, h, {
    base: INK,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 260),
    speckAlpha: [90, 230],
    speckGray: [200, 255],
    speckSize: [0.8, 2.2],
  });
  return { canvas, rect: TEX };
}

export default moonRow({
  ow: 1280,
  oh: 1280,
  art: [230, 602, 818, 96],
  scale: 0.66, // a long thin row reads too big at equal area
  bg: 239,
  R,
  cy: CY,
  xs: XS,
  keys: KEYS,
  ink: INK,
  ringW: RING,
  q0: 1, // the first moon is the first crescent
  rot: -Math.PI / 2, // lit on the left becomes lit at the bottom
  timing: { hold: HOLD, move: MOVE, pause: PAUSE, settle: SETTLE, scrub: SCRUB },
  tex: paperTexture,
});
