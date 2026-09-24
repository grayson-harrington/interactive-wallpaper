// Spinodal Decomposition  (Processing Round 4/spinodal decomposition)
//
// Of the many experiments in that folder, spinodal_conserved is the most
// complete 2D one: a conserved (Cahn-Hilliard style) cell-dynamics model of
// phase separation. Each step:
//   nextA = A*tanh(c) + D*(A1/6 + A2/12 - c)          (A1/A2: nearest /
//   nextB = nextA - (B1-A1)/6 - (B2-A2)/12             next-nearest sums)
// with periodic boundaries, starting from tiny random noise. The mixture
// separates into black/white domains that slowly coarsen. Like the original
// (noLoop after nstep) it stops computing once it has settled - either
// NSTEP steps or when the field barely changes - holds, then reseeds.
//
// The grid is ~5px per cell, rendered as a small image scaled up with
// smoothing so domains look like soft blobs rather than squares.
// Interactive: click to reseed.

const CELL = 5;
const D = 0.6;
const A = 1.3;
const LOW = -0.01;
const HIGH = 0.01;
const NSTEP = 2000;
const STEPS_PER_FRAME = 3;
const SETTLED = 2e-4; // mean |change| per step
const HOLD_MS = 5 * 60_000;

export default function spinodal(p) {
  let nx;
  let ny;
  let curr;
  let nextA;
  let nextB;
  let step = 0;
  let done = false;
  let holdScheduled = false;
  let buffer;
  let bufCtx;
  let image;

  function seed() {
    nx = Math.max(8, Math.round(p.width / CELL));
    ny = Math.max(8, Math.round(p.height / CELL));
    curr = new Float32Array(nx * ny);
    nextA = new Float32Array(nx * ny);
    nextB = new Float32Array(nx * ny);
    for (let k = 0; k < curr.length; k++) curr[k] = LOW + Math.random() * (HIGH - LOW);
    buffer = document.createElement('canvas');
    buffer.width = nx;
    buffer.height = ny;
    bufCtx = buffer.getContext('2d');
    image = bufCtx.createImageData(nx, ny);
    step = 0;
    done = false;
    holdScheduled = false;
  }

  // One step. Neighbor sums are inlined (nearest A1/B1, next-nearest A2/B2,
  // periodic bounds): this loop runs ~250k cells x 3 steps per frame.
  function advance() {
    for (let j = 0; j < ny; j++) {
      const jj = j * nx;
      const ju = (j + 1 === ny ? 0 : j + 1) * nx;
      const jd = (j === 0 ? ny - 1 : j - 1) * nx;
      for (let i = 0; i < nx; i++) {
        const ir = i + 1 === nx ? 0 : i + 1;
        const il = i === 0 ? nx - 1 : i - 1;
        const k = i + jj;
        const a1 = curr[ir + jj] + curr[il + jj] + curr[i + ju] + curr[i + jd];
        const a2 = curr[ir + ju] + curr[ir + jd] + curr[il + ju] + curr[il + jd];
        nextA[k] = A * Math.tanh(curr[k]) + D * (a1 / 6 + a2 / 12 - curr[k]);
      }
    }
    let change = 0;
    for (let j = 0; j < ny; j++) {
      const jj = j * nx;
      const ju = (j + 1 === ny ? 0 : j + 1) * nx;
      const jd = (j === 0 ? ny - 1 : j - 1) * nx;
      for (let i = 0; i < nx; i++) {
        const ir = i + 1 === nx ? 0 : i + 1;
        const il = i === 0 ? nx - 1 : i - 1;
        const k = i + jj;
        const a1 = curr[ir + jj] + curr[il + jj] + curr[i + ju] + curr[i + jd];
        const a2 = curr[ir + ju] + curr[ir + jd] + curr[il + ju] + curr[il + jd];
        const b1 = nextA[ir + jj] + nextA[il + jj] + nextA[i + ju] + nextA[i + jd];
        const b2 = nextA[ir + ju] + nextA[ir + jd] + nextA[il + ju] + nextA[il + jd];
        nextB[k] = nextA[k] - (b1 - a1) / 6 - (b2 - a2) / 12;
        change += Math.abs(nextB[k] - curr[k]);
      }
    }
    [curr, nextB] = [nextB, curr];
    step++;
    return change / curr.length;
  }

  function render() {
    const d = image.data;
    for (let k = 0; k < curr.length; k++) {
      const v = Math.max(0, Math.min(255, ((curr[k] + 1) / 2) * 255));
      d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v;
      d[k * 4 + 3] = 255;
    }
    bufCtx.putImageData(image, 0, 0);
    const ctx = p.drawingContext;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(buffer, 0, 0, p.width, p.height);
  }

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    seed();
  };

  p.draw = () => {
    if (done) {
      if (!holdScheduled) {
        holdScheduled = true;
        p.schedule(() => {
          seed();
          p.loop();
        }, HOLD_MS);
      }
      p.noLoop();
      return;
    }
    let change = Infinity;
    for (let s = 0; s < STEPS_PER_FRAME; s++) change = advance();
    render();
    // the early phase is slow to start, so only accept "settled" later on
    if (step >= NSTEP || (step > 400 && change < SETTLED)) done = true;
  };

  p.onActivate = () => {
    holdScheduled = false;
  };

  p.mouseClicked = () => {
    p.cancelScheduled();
    seed();
    p.loop();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    seed();
  };
}
