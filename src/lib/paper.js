// "Paper" textures, a recurring motif in the Daily Minimal pieces. The
// originals used two recipes, and each has a helper here:
//
//   paperCanvas     grain: 2x2 blocks of random white at low alpha across the
//                   whole surface, plus scattered brighter specks. Used for
//                   paper-textured objects and faces (S02-181, S02-238,
//                   S02-459, IF-004).
//   dotPaperCanvas  dots: many random 1px dots in a narrow grey range, the
//                   originals' paper(c, alpha) function. Used for dark paper
//                   backgrounds and shimmering grain layers (S02-401, S02-368).
//
// Both render once into an offscreen canvas (straight into ImageData, so it
// takes milliseconds instead of the originals' seconds). Draw the result with
// drawImage, or clip it to a shape with fillPathWithTexture.

const rand = (a, b) => a + Math.random() * (b - a);

// Returns an offscreen <canvas> of w x h.
//   base        [r,g,b] fill color (or a single gray value)
//   grainAlpha  [min,max] alpha (0-255) of the 2x2 white-ish grain blocks
//   specks      number of brighter specks
//   speckAlpha  [min,max]
//   speckGray   [min,max] gray level of the specks (low for dark flecks)
//   speckSize   [min,max] side length in px
//   transparent start from transparent instead of `base` (grain only)
export function paperCanvas(
  w,
  h,
  {
    base = 239,
    grainAlpha = [10, 20],
    specks = Math.round((w * h) / 500),
    speckAlpha = [50, 75],
    speckSize = [1, 3],
    speckGray = [200, 255],
    transparent = false,
  } = {},
) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const [br, bg, bb] = Array.isArray(base) ? base : [base, base, base];

  for (let j = 0; j < h; j += 2) {
    for (let i = 0; i < w; i += 2) {
      const g = rand(200, 255);
      const a = rand(grainAlpha[0], grainAlpha[1]) / 255;
      for (let y = j; y < Math.min(j + 2, h); y++) {
        for (let x = i; x < Math.min(i + 2, w); x++) {
          const k = (y * w + x) * 4;
          if (transparent) {
            d[k] = d[k + 1] = d[k + 2] = g;
            d[k + 3] = a * 255;
          } else {
            d[k] = br + (g - br) * a;
            d[k + 1] = bg + (g - bg) * a;
            d[k + 2] = bb + (g - bb) * a;
            d[k + 3] = 255;
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  for (let s = 0; s < specks; s++) {
    const g = Math.round(rand(speckGray[0], speckGray[1]));
    ctx.fillStyle = `rgba(${g},${g},${g},${rand(speckAlpha[0], speckAlpha[1]) / 255})`;
    ctx.fillRect(rand(0, w), rand(0, h), rand(speckSize[0], speckSize[1]), rand(speckSize[0], speckSize[1]));
  }
  return canvas;
}

// Returns an offscreen <canvas> of w x h covered in random 1px dots.
//   base     [r,g,b] or gray fill underneath; null leaves it transparent and
//            each dot replaces the pixel (a grain layer to draw over things)
//   gray     [min,max] gray level of the dots
//   alpha    [min,max] alpha (0-255) of the dots
//   density  dots per pixel of area (the originals used 1/5)
//   soft     place dots at sub-pixel positions, spread over their 4 nearest
//            pixels, like the originals' fillRect at random fractional x/y
//            (opaque base only)
export function dotPaperCanvas(w, h, { base = null, gray = [190, 210], alpha = [95, 105], density = 1 / 5, soft = false } = {}) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  if (base !== null) {
    const [br, bg, bb] = Array.isArray(base) ? base : [base, base, base];
    for (let k = 0; k < d.length; k += 4) {
      d[k] = br;
      d[k + 1] = bg;
      d[k + 2] = bb;
      d[k + 3] = 255;
    }
  }
  const n = Math.round(w * h * density);
  // blend like fillRect would, so repeated hits build up
  const blend = (x, y, g, t) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = (y * w + x) * 4;
    d[k] += (g - d[k]) * t;
    d[k + 1] += (g - d[k + 1]) * t;
    d[k + 2] += (g - d[k + 2]) * t;
  };
  for (let i = 0; i < n; i++) {
    const g = rand(gray[0], gray[1]);
    const a = rand(alpha[0], alpha[1]);
    if (base === null) {
      const k = Math.floor(Math.random() * w * h) * 4;
      d[k] = d[k + 1] = d[k + 2] = g;
      d[k + 3] = a;
    } else if (soft) {
      const x = Math.random() * w - 0.5;
      const y = Math.random() * h - 0.5;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const t = a / 255;
      blend(x0, y0, g, t * (1 - fx) * (1 - fy));
      blend(x0 + 1, y0, g, t * fx * (1 - fy));
      blend(x0, y0 + 1, g, t * (1 - fx) * fy);
      blend(x0 + 1, y0 + 1, g, t * fx * fy);
    } else {
      blend(Math.floor(Math.random() * w), Math.floor(Math.random() * h), g, a / 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Fill the current path of a 2D context with a texture that is positioned in
// the same coordinate space as the drawing (Processing's texture() with
// vertex uv == vertex xy). Caller builds the path first.
export function fillPathWithTexture(ctx, texture, x = 0, y = 0) {
  ctx.save();
  ctx.clip();
  ctx.drawImage(texture, x, y);
  ctx.restore();
}
