// S02-015 moon phases
// Seven moons in a row, waxing from a new-moon ring to full. After a 15s rest
// every moon advances one phase at a time, twelve quick steps in about 40s,
// so the sequence rolls left along the row: the full moon wanes (lit on the
// other side) back through the crescents to a ring, and after the twelfth
// step the row is the original again. The moons slide as
// their shapes change so the gaps between them stay equal, with the middle
// moon held at the center. With someone at the page, moving the cursor
// sideways scrubs the phases; when they leave, the row eases to the nearest
// step and rolls on to the original.
import { moonRow } from './moons.js';
import { dotPaperCanvas, paperCanvas } from '../../lib/paper.js';

const bg = 22;
const ringGray = 245;

// Geometry, measured: 100px moons on y=640. XS are the original's centers,
// used only to give each moon its own patch of paper; the layout below
// places them.
const CY = 640;
const XS = [291, 428, 524, 634, 731, 855, 989];
const R = 50;
const RING = 5;

// Layout: an equal GAP between the moons' visible edges, the middle moon's
// visible center at MID. GAP keeps the rest pose's span close to the
// original's.
const GAP = 39;
const MID = 640;

// Phase keyframes, lit on the left, as [m, k] (see moons.js). Fitted to the
// original; the first and last are the empty and full moon.
const KEYS = [
  [-50, 0.02],
  [-30, 0.02137],
  [-20.29, 0.02071],
  [0, 0],
  [35.25, -0.01596],
  [43.56, -0.01645],
  [50, -0.02],
];

// Timing, in seconds.
const HOLD = 15; // on the original
const MOVE = 1.8; // one phase step
const PAUSE = 1.5; // between steps
const SETTLE = 6; // to the nearest step after someone leaves
const SCRUB = 110; // px of cursor travel per phase step

// Paper for the lit parts, covering the whole row.
const TEX = [XS[0] - R - 2, CY - R - 2, XS[6] - XS[0] + 2 * R + 4, 2 * R + 4];

function paperTexture() {
  const [, , w, h] = TEX;
  const tex = dotPaperCanvas(w, h, { base: 240, gray: [185, 255], alpha: [60, 140], density: 1 });
  const flecks = paperCanvas(w, h, {
    transparent: true,
    grainAlpha: [0, 0],
    specks: Math.round((w * h) / 140),
    speckAlpha: [50, 170],
    speckGray: [20, 110],
    speckSize: [0.8, 2.2],
  });
  tex.getContext('2d').drawImage(flecks, 0, 0);
  return { canvas: tex, rect: TEX };
}

export default moonRow({
  ow: 1280,
  oh: 1280,
  scale: 0.7, // a long thin row reads too big at equal area; ~60% of the width
  bg,
  R,
  cy: CY,
  xs: XS,
  keys: KEYS,
  ink: ringGray,
  ringW: RING,
  gap: { gap: GAP, mid: MID },
  timing: { hold: HOLD, move: MOVE, pause: PAUSE, settle: SETTLE, scrub: SCRUB },
  tex: paperTexture,
});
