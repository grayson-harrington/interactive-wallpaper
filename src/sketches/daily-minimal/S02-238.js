// S02-238 fractal cube
// A Menger sponge of paper-textured faces. At rest it is the original: one
// sponge step (20 boxes) seen straight down a body diagonal, flat, like an
// isometric drawing. After a 15s hold it starts to tumble, subdivides once
// more partway through, merges back, and coasts to a stop on the original
// view. A click subdivides it (or merges it back) at any time.
//
// WebGL: the boxes for the current depth are baked into three p5.Geometry
// objects (one per paper texture) instead of re-emitting ~2400 textured quads
// every frame.

import { SIZE, restCycle, coastTo } from './harness.js';
import { paperCanvas } from '../../lib/paper.js';

const backC = 239;
const ORIGINAL = 600;
// Sizing like the harness: the rest pose (a cube of side 250 seen down its
// diagonal) has a bounding box with the area of a square about 347 across.
const ART = 347;
const SCALE = 1; // per-piece size tuning
const REST_DEPTH = 2;
const MAX_DEPTH = 3;
// Rest view: down a body diagonal, from below as in the original.
const REST_X = Math.atan(1 / Math.SQRT2);
const REST_Y = -Math.PI / 4;

// Timing, in seconds.
const HOLD = 15;
const LEAVE = 6; // tumbling up to speed
const AWAY = 30; // one more subdivision a third of the way in, merged back at two thirds
const BACK = 7; // coasting to a stop on the rest view
const SPIN = [0.225, 0.19]; // tumble, radians per second about x and y

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
  let rot = [REST_X, REST_Y];
  let home = null;
  let armed = false;
  const cycle = restCycle({ hold: HOLD, leave: LEAVE, away: AWAY, back: BACK });

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

  function setDepth(d) {
    boxes = [[0, 0, 0, 250]];
    for (depth = 1; depth < d; depth++) boxes = subdivide(boxes);
    bake();
  }

  p.setup = () => {
    // full retina density keeps edges smooth
    p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
    p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
    p.frameRate(30);
    p.textureMode(p.NORMAL);
    textures = [paperTexture(218), paperTexture(118), paperTexture(45)];
    setDepth(REST_DEPTH);
  };

  p.draw = () => {
    const dt = Math.min(p.deltaTime, 100) / 1000;
    const c = cycle.step(dt);
    if (c.phase === 'leave' || c.phase === 'away') {
      const rate = c.phase === 'leave' ? c.k : 1;
      rot[0] += SPIN[0] * rate * dt;
      rot[1] += SPIN[1] * rate * dt;
      if (c.phase === 'away') {
        const want = c.u > 1 / 3 && c.u < 2 / 3 ? MAX_DEPTH : REST_DEPTH;
        if (!p.interactive() && depth !== want) setDepth(want);
      }
    } else if (c.phase === 'back') {
      if (c.turned) {
        home = [coastTo(rot[0], SPIN[0], REST_X, BACK), coastTo(rot[1], SPIN[1], REST_Y, BACK)];
        if (depth !== REST_DEPTH) setDepth(REST_DEPTH);
      }
      rot = [home[0](c.u), home[1](c.u)];
    } else {
      rot = [REST_X, REST_Y];
    }

    p.background(backC);
    const k = (SIZE * SCALE * Math.min(p.width, p.height)) / ART;
    p.ortho(-p.width / 2, p.width / 2, -p.height / 2, p.height / 2, -5000, 5000);
    p.scale(k);
    p.rotateX(rot[0]);
    p.rotateY(rot[1]);
    p.noStroke();
    for (let i = 0; i < 3; i++) {
      p.texture(textures[i]);
      p.model(geoms[i]);
    }

    if (c.phase === 'hold') {
      if (!armed) {
        armed = true;
        p.schedule(() => {
          armed = false;
          cycle.skip();
          p.loop();
        }, c.left * 1000);
      }
      p.noLoop();
    }
  };

  p.onActivate = () => {
    armed = false; // the hold timer was cancelled when hidden
  };

  p.mouseReleased = () => {
    setDepth(depth === REST_DEPTH ? MAX_DEPTH : REST_DEPTH);
    p.redraw();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
}
