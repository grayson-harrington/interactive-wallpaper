// S02-238 fractal cube
// A slowly tumbling cube of paper-textured faces. Each iteration replaces
// every box with the 20 sub-boxes of a Menger sponge step (depth 1-3).
// The original iterated on click (still does); in ambient mode it iterates on
// its own, holds at full depth, then starts over.
//
// WebGL: the boxes for the current depth are baked into three p5.Geometry
// objects (one per paper texture) instead of re-emitting ~2400 textured quads
// every frame.

import { FIT } from './harness.js';
import { paperCanvas } from '../../lib/paper.js';

const backC = 239;
const ORIGINAL = 600;
const maxDepth = 3;
const STEP_FRAMES = 45 * 7; // ~7s per depth in ambient mode
const HOLD_FRAMES = 45 * 16;

function subdivide(boxes) {
  const out = [];
  for (const [x, y, z, w] of boxes) {
    const nw = w / 3;
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (let k = -1; k <= 1; k++) if (i * j * k === 0) out.push([x + i * nw, y + j * nw, z + k * nw, nw]);
  }
  return out;
}

export default function fractalCube(p) {
  let textures;
  let geoms = [];
  let depth = 1;
  let boxes;
  let timer = 0;
  let angle = 0;

  function paperTexture(base) {
    // rendered at 2x the original so the grain stays crisp on large/retina screens
    const S2 = ORIGINAL * 2;
    const src = paperCanvas(S2, S2, { base, specks: (S2 * S2) / 250, speckSize: [0.5, 2] });
    const g = p.createGraphics(S2, S2);
    g.pixelDensity(1);
    g.drawingContext.drawImage(src, 0, 0);
    return g;
  }

  // uv follows the original: face-plane coordinates + width/2, normalized
  const uv = (v) => (v + ORIGINAL / 2) / ORIGINAL;

  function quad(verts, uvs) {
    p.beginShape(p.QUADS);
    for (let i = 0; i < 4; i++) p.vertex(...verts[i], uv(uvs[i][0]), uv(uvs[i][1]));
    p.endShape();
  }

  function bake() {
    // [texture index, faces]: dark = top/bottom, light = left/right, medium = front/back
    const groups = [[], [], []];
    for (const [x, y, z, w] of boxes) {
      const h = w / 2;
      const [x0, x1, y0, y1, z0, z1] = [x - h, x + h, y - h, y + h, z - h, z + h];
      groups[2].push(
        [[[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], [[x0, z0], [x0, z1], [x1, z1], [x1, z0]]],
        [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [[x0, z0], [x0, z1], [x1, z1], [x1, z0]]],
      );
      groups[0].push(
        [[[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], [[y0, z0], [y0, z1], [y1, z1], [y1, z0]]],
        [[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[y0, z0], [y0, z1], [y1, z1], [y1, z0]]],
      );
      groups[1].push(
        [[[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]],
        [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]],
      );
    }
    for (const g of geoms) p.freeGeometry(g);
    geoms = groups.map((faces) =>
      p.buildGeometry(() => {
        p.noStroke();
        for (const [verts, uvs] of faces) quad(verts, uvs);
      }),
    );
  }

  function reset() {
    depth = 1;
    boxes = [[0, 0, 0, 250]];
    timer = 0;
    bake();
  }

  function iterate() {
    if (depth === maxDepth) return;
    boxes = subdivide(boxes);
    depth++;
    timer = 0;
    bake();
  }

  p.setup = () => {
    // full retina density keeps edges smooth
    p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.frameRate(45);
    p.textureMode(p.NORMAL);
    textures = [paperTexture(218), paperTexture(118), paperTexture(45)];
    reset();
  };

  p.draw = () => {
    if (!p.interactive()) {
      timer++;
      if (depth < maxDepth && timer > STEP_FRAMES) iterate();
      else if (depth === maxDepth && timer > HOLD_FRAMES) reset();
    }

    angle += 0.005;
    p.background(backC);
    const k = (Math.min(p.width, p.height) / ORIGINAL) * FIT;
    p.scale(k);
    p.rotateX(angle);
    p.rotateY(angle);
    p.noStroke();
    for (let i = 0; i < 3; i++) {
      p.texture(textures[i]);
      p.model(geoms[i]);
    }
  };

  p.mouseReleased = () => {
    if (depth === maxDepth) reset();
    else iterate();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
}
