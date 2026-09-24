// "Paper" grain textures, a recurring motif in the Daily Minimal pieces.
//
// The originals built these with tens of thousands of fill()+rect() calls
// (one 2x2 block of random white at low alpha across the whole surface, plus
// scattered brighter specks). Same recipe here, written straight into
// ImageData so it takes milliseconds instead of seconds.

const rand = (a, b) => a + Math.random() * (b - a);

// Returns an offscreen <canvas> of w x h.
//   base        [r,g,b] fill color (or a single gray value)
//   grainAlpha  [min,max] alpha (0-255) of the 2x2 white-ish grain blocks
//   specks      number of brighter specks
//   speckAlpha  [min,max]
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
    const g = Math.round(rand(200, 255));
    ctx.fillStyle = `rgba(${g},${g},${g},${rand(speckAlpha[0], speckAlpha[1]) / 255})`;
    ctx.fillRect(rand(0, w), rand(0, h), rand(speckSize[0], speckSize[1]), rand(speckSize[0], speckSize[1]));
  }
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
