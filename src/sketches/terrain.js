// Procedural Terrain  (Processing Round 4/Procedural Terrain Generation)
//
// The island/, islands/ and world_map/ variants on disk are byte-identical, so
// they are one entry here. A grid of independent islands: two-octave Perlin
// elevation (raised to a power) and moisture maps, elevation pulled down with
// distance from a handful of random "gradient" points so each tile is an
// island, Whittaker-style biome coloring, and a light paper grain on top.
//
// Tiles are ~160px as in the original, stretched slightly so the grid fills
// the screen exactly. They're generated a few per frame (so the page never
// stalls and the map fills in tile by tile), then the sketch goes idle.
// Interactive: click to generate a new map.

const TILE = 160;
const TILES_PER_FRAME = 3;

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const C = {
  WATER_SHALLOW: hex(0x5250cb),
  WATER_DEEP: hex(0x323181),
  BEACH: hex(0x9e907b),
  TROPICAL_RAIN_FOREST: hex(0xa2baaa),
  TROPICAL_SEASONAL_FOREST: hex(0xb0cba8),
  GRASSLAND: hex(0xc7d4ae),
  SUBTROPICAL_DESERT: hex(0xe7ddc9),
  TEMPERATE_RAIN_FOREST: hex(0xaac3aa),
  TEMPERATE_DECIDUOUS_FOREST: hex(0xb8c9ac),
  TEMPERATE_DESERT: hex(0xe5e8cd),
  SHRUBLAND: hex(0xc6cbbd),
  TAIGA: hex(0xced4bd),
  TUNDRA: hex(0xddddbf),
  BARE: hex(0xbbbbbb),
  SCORCHED: hex(0x999999),
  SNOW: hex(0xf8f8f8),
};

const rand = (a, b) => a + Math.random() * (b - a);

function biome(ocean, e, m, out) {
  let c;
  if (e < ocean) {
    const t = Math.min(1, Math.max(0, e / ocean));
    out[0] = C.WATER_DEEP[0] + (C.WATER_SHALLOW[0] - C.WATER_DEEP[0]) * t;
    out[1] = C.WATER_DEEP[1] + (C.WATER_SHALLOW[1] - C.WATER_DEEP[1]) * t;
    out[2] = C.WATER_DEEP[2] + (C.WATER_SHALLOW[2] - C.WATER_DEEP[2]) * t;
    return out;
  }
  if (e < ocean + 0.01) c = C.BEACH;
  else {
    const temperature = 1 - e;
    if (temperature < 0.3) {
      if (m > 0.3) c = C.SNOW;
      else if (m > 0.2) c = C.TUNDRA;
      else if (m > 0.08) c = C.BARE;
      else c = C.SCORCHED;
    } else if (temperature < 0.5) {
      if (m > 0.66) c = C.TAIGA;
      else if (m > 0.33) c = C.SHRUBLAND;
      else c = C.TEMPERATE_DESERT;
    } else if (temperature < 0.7) {
      if (m > 0.83) c = C.TEMPERATE_RAIN_FOREST;
      else if (m > 0.5) c = C.TEMPERATE_DECIDUOUS_FOREST;
      else if (m > 0.16) c = C.GRASSLAND;
      else c = C.TEMPERATE_DESERT;
    } else {
      if (m > 0.66) c = C.TROPICAL_RAIN_FOREST;
      else if (m > 0.33) c = C.TROPICAL_SEASONAL_FOREST;
      else if (m > 0.16) c = C.GRASSLAND;
      else c = C.SUBTROPICAL_DESERT;
    }
  }
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
  return out;
}

export default function terrain(p) {
  let cols;
  let rows;
  let queue = [];
  let img;

  function heightMap(w, h, octaves, power, scale, seed) {
    const map = new Float32Array(w * h);
    const nScale = 0.001 + (0.05 - 0.001) * scale;
    p.noiseSeed(seed);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        let val = 0;
        for (let o = 0; o < octaves; o++) {
          const f = 2 ** o;
          val += (1 / f) * p.noise(f * i * nScale, f * j * nScale);
        }
        map[j * w + i] = val ** power;
      }
    }
    return map;
  }

  function island(x0, y0, w, h) {
    const elevation = heightMap(w, h, 2, 1.3, 0.6, Math.floor(rand(-99999, 99999)));
    const moisture = heightMap(w, h, 2, 1, 0.6, Math.floor(rand(-99999, 99999)));

    // bound()
    let max = 0;
    for (const v of elevation) if (v > max) max = v;
    if (max > 1) for (let k = 0; k < elevation.length; k++) elevation[k] /= max;

    // applyFilter(): fade elevation with distance to the nearest gradient point
    const numGradients = Math.floor(rand(6, 10));
    const gradientSize = w * 0.6;
    const pts = Array.from({ length: numGradients }, () => [
      Math.floor(rand(w / 3.5, w - w / 3.5)),
      Math.floor(rand(h / 3.5, h - h / 3.5)),
    ]);
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        let minD = w * 3;
        for (const [gx, gy] of pts) {
          const d = Math.hypot(gx - i, gy - j);
          if (d < minD) minD = d;
        }
        const k = j * w + i;
        elevation[k] = elevation[k] * (1 - minD / (gradientSize / 2));
      }
    }

    const d = img.data;
    const W = img.width;
    const rgb = [0, 0, 0];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        biome(0.2, elevation[j * w + i], moisture[j * w + i], rgb);
        const k = ((y0 + j) * W + (x0 + i)) * 4;
        d[k] = rgb[0];
        d[k + 1] = rgb[1];
        d[k + 2] = rgb[2];
        d[k + 3] = 255;
      }
    }
    // paper(): 2x2 blocks of fill(225, random(30, 40))
    for (let j = 0; j < h; j += 2) {
      for (let i = 0; i < w; i += 2) {
        const a = rand(30, 40) / 255;
        for (let y = j; y < Math.min(j + 2, h); y++) {
          for (let x = i; x < Math.min(i + 2, w); x++) {
            const k = ((y0 + y) * W + (x0 + x)) * 4;
            d[k] += (225 - d[k]) * a;
            d[k + 1] += (225 - d[k + 1]) * a;
            d[k + 2] += (225 - d[k + 2]) * a;
          }
        }
      }
    }
  }

  function regenerate() {
    cols = Math.max(1, Math.round(p.width / TILE));
    rows = Math.max(1, Math.round(p.height / TILE));
    // start as open ocean (deep water + the same paper grain the tiles get), so
    // islands appear to rise out of the sea as their tiles are generated
    img = p.drawingContext.createImageData(p.width, p.height);
    const d = img.data;
    const W = p.width;
    for (let j = 0; j < p.height; j += 2) {
      for (let i = 0; i < W; i += 2) {
        const a = rand(30, 40) / 255;
        for (let y = j; y < Math.min(j + 2, p.height); y++) {
          for (let x = i; x < Math.min(i + 2, W); x++) {
            const k = (y * W + x) * 4;
            d[k] = C.WATER_DEEP[0] + (225 - C.WATER_DEEP[0]) * a;
            d[k + 1] = C.WATER_DEEP[1] + (225 - C.WATER_DEEP[1]) * a;
            d[k + 2] = C.WATER_DEEP[2] + (225 - C.WATER_DEEP[2]) * a;
            d[k + 3] = 255;
          }
        }
      }
    }
    queue = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) queue.push([i, j]);
    // fill in a random order so the map "develops" across the screen
    for (let i = queue.length - 1; i > 0; i--) {
      const r = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[r]] = [queue[r], queue[i]];
    }
    p.drawingContext.putImageData(img, 0, 0);
    p.loop();
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(p.windowWidth, p.windowHeight);
    regenerate();
  };

  p.draw = () => {
    if (queue.length === 0) {
      p.noLoop();
      return;
    }
    for (let n = 0; n < TILES_PER_FRAME && queue.length; n++) {
      const [i, j] = queue.pop();
      const x0 = Math.round((i * p.width) / cols);
      const x1 = Math.round(((i + 1) * p.width) / cols);
      const y0 = Math.round((j * p.height) / rows);
      const y1 = Math.round(((j + 1) * p.height) / rows);
      island(x0, y0, x1 - x0, y1 - y0);
    }
    p.drawingContext.putImageData(img, 0, 0);
  };

  // browsers may drop a hidden canvas's pixels; repaint
  p.onActivate = () => {
    if (img && img.width === p.width) p.drawingContext.putImageData(img, 0, 0);
  };

  p.mouseClicked = regenerate;

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    regenerate();
  };
}
