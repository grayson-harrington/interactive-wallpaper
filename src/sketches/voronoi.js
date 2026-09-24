// Voronoi Images  (Processing Round 5/voronoi_images)
//
// Scatters random seed points over a photo, assigns every pixel to its nearest
// seed and paints each Voronoi cell with the average color of the pixels it
// owns. Rendered once, then idle.
//
// The original's QuadTree was only an acceleration structure for "which seeds
// are near this pixel"; a uniform bucket grid does the same job more simply
// here (each pixel checks the seeds in the surrounding 5x5 buckets, the same
// kind of bounded-neighborhood approximation the original's query box made).
//
// Images come from images/voronoi/, listed live by the
// server: drop a photo in there and it joins the rotation, no rebuild.
//
// Interactive: click for the next image, right-click to pick any image file
// from disk, +/- or the Cells slider to change the number of cells.

import { createPanel, autoFade } from '../lib/panel.js';

async function listImages() {
  const res = await fetch('/api/voronoi-images', { cache: 'no-store' });
  if (!res.ok) throw new Error(res.statusText);
  return (await res.json()).files.map((f) => `/voronoi-images/${encodeURIComponent(f)}`);
}

// "good sizes" from the original
const SIZES = [15, 25, 50, 100, 175, 250, 500, 1000, 2000, 5000, 10000, 25000];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Draw `img` into a w x h canvas like CSS object-fit: cover and read it back.
function coverPixels(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return ctx.getImageData(0, 0, w, h).data;
}

export function voronoiInto(out, src, w, h, n) {
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = Math.floor(Math.random() * w);
    py[i] = Math.floor(Math.random() * h);
  }

  // bucket grid, ~1 seed per bucket
  const size = Math.max(4, Math.sqrt((w * h) / n));
  const bw = Math.ceil(w / size);
  const bh = Math.ceil(h / size);
  const buckets = Array.from({ length: bw * bh }, () => []);
  for (let i = 0; i < n; i++) {
    buckets[Math.min(bh - 1, Math.floor(py[i] / size)) * bw + Math.min(bw - 1, Math.floor(px[i] / size))].push(i);
  }
  // candidates for each bucket = seeds in the surrounding 5x5 block
  const cands = new Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const list = [];
      for (let r = 2; list.length === 0 && r < Math.max(bw, bh); r += 1) {
        for (let y = Math.max(0, by - r); y <= Math.min(bh - 1, by + r); y++) {
          for (let x = Math.max(0, bx - r); x <= Math.min(bw - 1, bx + r); x++) {
            for (const i of buckets[y * bw + x]) list.push(i);
          }
        }
      }
      cands[by * bw + bx] = Int32Array.from(list);
    }
  }

  const owner = new Int32Array(w * h);
  const sr = new Float64Array(n);
  const sg = new Float64Array(n);
  const sb = new Float64Array(n);
  const cnt = new Uint32Array(n);

  for (let y = 0; y < h; y++) {
    const by = Math.min(bh - 1, Math.floor(y / size));
    for (let x = 0; x < w; x++) {
      const list = cands[by * bw + Math.min(bw - 1, Math.floor(x / size))];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < list.length; c++) {
        const i = list[c];
        const dx = px[i] - x;
        const dy = py[i] - y;
        const dd = dx * dx + dy * dy;
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      }
      const k = y * w + x;
      owner[k] = best;
      sr[best] += src[k * 4];
      sg[best] += src[k * 4 + 1];
      sb[best] += src[k * 4 + 2];
      cnt[best]++;
    }
  }

  for (let k = 0; k < w * h; k++) {
    const i = owner[k];
    const c = cnt[i] || 1;
    out[k * 4] = sr[i] / c;
    out[k * 4 + 1] = sg[i] / c;
    out[k * 4 + 2] = sb[i] / c;
    out[k * 4 + 3] = 255;
  }
}

export default function voronoi(p) {
  let images = [];
  let imgIndex = 0;
  let custom = null; // an image picked from disk (object URL)
  let sizeIndex = SIZES.indexOf(2000);
  let dirty = true;
  let busy = false;
  let last = null; // last rendered ImageData, to repaint after being hidden
  let picker;
  let sizeSlider;
  const cache = new Map();

  async function render() {
    busy = true;
    try {
      let src = custom;
      if (!src) {
        images = await listImages();
        if (!images.length) throw new Error('no images');
        imgIndex %= images.length;
        src = images[imgIndex];
      }
      if (!cache.has(src)) cache.set(src, await loadImage(src));
      const img = cache.get(src);
      const w = p.width;
      const h = p.height;
      const pixels = coverPixels(img, w, h);
      const out = p.drawingContext.createImageData(w, h);
      voronoiInto(out.data, pixels, w, h, SIZES[sizeIndex]);
      if (w === p.width && h === p.height) {
        last = out;
        p.drawingContext.putImageData(out, 0, 0);
      }
    } catch {
      // server unreachable or empty folder: leave the canvas as is
    } finally {
      busy = false;
      if (dirty) p.loop(); // a change arrived while computing
    }
  }

  function rerender() {
    dirty = true;
    p.loop();
  }

  function next() {
    if (custom) {
      URL.revokeObjectURL(custom);
      cache.delete(custom);
      custom = null;
    } else imgIndex++;
    rerender();
  }

  function buildControls() {
    const parent = p.canvas.parentElement;
    picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'image/*';
    picker.hidden = true;
    parent.append(picker);
    picker.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (!file) return;
      if (custom) URL.revokeObjectURL(custom);
      custom = URL.createObjectURL(file);
      picker.value = '';
      rerender();
    });
    p.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      picker.click();
    });

    const panel = createPanel(parent, { title: 'Voronoi', toggleLabel: 'Voronoi controls' });
    sizeSlider = panel.range(
      'Cells',
      { min: 0, max: SIZES.length - 1, value: sizeIndex, format: (i) => SIZES[i].toLocaleString() },
      (i) => {
        sizeIndex = i;
        rerender();
      },
    );
    panel.buttons([
      ['Next image', next],
      ['Choose image…', () => picker.click()],
      ['Hide', () => panel.hide()],
    ]);
    panel.note('Click: next image · right-click: choose a file · +/-: cells. Images live in images/voronoi/ (new files are picked up automatically).');
    autoFade([panel.el, panel.toggle]);
  }

  p.setup = () => {
    p.pixelDensity(1);
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.background(0);
    buildControls();
  };

  p.draw = () => {
    if (dirty && !busy) {
      dirty = false;
      render();
    }
    p.noLoop();
  };

  // browsers may drop a hidden canvas's pixels; repaint from the last result
  p.onActivate = () => {
    if (last && last.width === p.width && last.height === p.height) p.drawingContext.putImageData(last, 0, 0);
  };

  p.mouseClicked = (e) => {
    if (!e || e.button === 0) next();
  };

  p.keyPressed = () => {
    if (p.key === '+' || p.key === '=') sizeIndex = Math.min(SIZES.length - 1, sizeIndex + 1);
    else if (p.key === '-' || p.key === '_') sizeIndex = Math.max(0, sizeIndex - 1);
    else return;
    sizeSlider.set(sizeIndex);
    rerender();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    rerender();
  };
}
