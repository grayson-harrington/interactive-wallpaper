// Game of Life  (Processing Round 2/Mathematical/GameOfLife)
//
// Two modes:
//  * Ambient (default): a random soup runs on its own. Stagnation - a still
//    life, or any short cycle (a repeat of one of the last 32 boards) - is
//    detected by hashing each generation; the board then stops computing,
//    holds for a few seconds, and reseeds. Unchanged boards are never redrawn.
//  * Edit: any click or key on the board switches to the original editor,
//    feature for feature:
//      space  pause/run          r  reseed at the current probability
//      c      clear (pauses)     n  "Probability of Life" start screen
//      click  toggle a cell      drag  paint/erase (while paused)
//      right-drag  select a region and copy it
//      p      paste mode: arrows rotate/flip, click to stamp, Esc cancels
//    The cell color is adjustable from the Colors button (bottom right).
//      m      back to ambient mode (also happens after 2 idle minutes)

import { createHud, createPanel, autoFade } from '../lib/panel.js';

const DEFAULT_COLOR = '#5a8a58'; // muted from the original's neon color(12, 242, 10)
const COLOR_KEY = 'iw:gol:color';
const CELL = 10;
const EDIT_IDLE_MS = 120_000;
const HOLD_MS = 4000;
const HISTORY = 32;
const MAX_GENERATIONS = 5000;

const FONT_URL = `${import.meta.env.BASE_URL}assets/fonts/LCD_Solid.ttf`;
let fontReady = null;
function loadFont() {
  fontReady ??= new FontFace('LCD Solid', `url(${FONT_URL})`)
    .load()
    .then((f) => document.fonts.add(f))
    .catch(() => {});
  return fontReady;
}

export default function gameOfLife(p) {
  let numX = 0;
  let numY = 0;
  let cells;
  let next;
  let grid; // offscreen grid-line overlay

  let mode = 'ambient';
  let lastEditInput = 0;
  let probability = 25;

  // ambient bookkeeping
  const history = [];
  let generation = 0;
  let stagnant = false;
  let holdScheduled = false;
  let dirty = true;

  // editor state (names follow the original)
  let gettingProb = false;
  let input = '';
  let pause = false;
  let tickToggle = 0;
  let pasting = false;
  let copy = null;
  let startX = -1;
  let startY = -1;
  let endX = -1;
  let endY = -1;
  let selecting = false;
  let dragged = false;
  let drawMode = true;
  let px = -1;
  let py = -1;

  let hud;
  let alive = DEFAULT_COLOR;
  try {
    alive = localStorage.getItem(COLOR_KEY) || DEFAULT_COLOR;
  } catch {
    // storage unavailable
  }
  let hudFade;

  const idx = (i, j) => i + j * numX;

  // ---- board ---------------------------------------------------------------

  function allocate() {
    const nx = Math.max(1, Math.floor(p.width / CELL));
    const ny = Math.max(1, Math.floor(p.height / CELL));
    const fresh = new Uint8Array(nx * ny);
    if (cells) {
      for (let j = 0; j < Math.min(ny, numY); j++)
        for (let i = 0; i < Math.min(nx, numX); i++) fresh[i + j * nx] = cells[idx(i, j)];
    }
    numX = nx;
    numY = ny;
    cells = fresh;
    next = new Uint8Array(nx * ny);
    buildGrid();
    dirty = true;
  }

  function buildGrid() {
    const d = p.pixelDensity();
    grid = document.createElement('canvas');
    grid.width = p.width * d;
    grid.height = p.height * d;
    const g = grid.getContext('2d');
    g.scale(d, d);
    g.strokeStyle = 'rgb(28,28,28)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= numX; i++) {
      g.moveTo(i * CELL + 0.5, 0);
      g.lineTo(i * CELL + 0.5, numY * CELL);
    }
    for (let j = 0; j <= numY; j++) {
      g.moveTo(0, j * CELL + 0.5);
      g.lineTo(numX * CELL, j * CELL + 0.5);
    }
    g.stroke();
  }

  function setCells(prob = probability) {
    for (let k = 0; k < cells.length; k++) {
      cells[k] = Math.floor(Math.random() * 100) < prob ? 1 : 0;
      next[k] = 0;
    }
    if (prob === 0) pause = true;
    history.length = 0;
    generation = 0;
    stagnant = false;
    holdScheduled = false;
    dirty = true;
  }

  function nextTick() {
    for (let j = 0; j < numY; j++) {
      for (let i = 0; i < numX; i++) {
        let n = 0;
        for (let y = j - 1; y <= j + 1; y++) {
          if (y < 0 || y >= numY) continue;
          for (let x = i - 1; x <= i + 1; x++) {
            if (x < 0 || x >= numX || (x === i && y === j)) continue;
            n += cells[x + y * numX];
          }
        }
        const k = idx(i, j);
        next[k] = cells[k] ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
      }
    }
    [cells, next] = [next, cells];
    generation++;
    dirty = true;
  }

  function hash() {
    // FNV-1a over the board
    let h = 2166136261;
    for (let k = 0; k < cells.length; k++) {
      h ^= cells[k];
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ---- drawing -------------------------------------------------------------

  function displayCells() {
    const ctx = p.drawingContext;
    p.background(0);
    ctx.fillStyle = alive;
    for (let j = 0; j < numY; j++)
      for (let i = 0; i < numX; i++) if (cells[idx(i, j)]) ctx.fillRect(i * CELL, j * CELL, CELL, CELL);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(grid, 0, 0);
    ctx.restore();
  }

  function textScreen() {
    p.background(0);
    p.textFont('LCD Solid');
    p.noStroke();
    p.fill(alive);
    p.textAlign(p.CENTER);
    p.textSize(50);
    p.text('The Game of Life', p.width / 2, p.height / 4);
    p.textSize(30);
    p.text('Probability of Life:', p.width / 2, p.height / 2);
    p.text('%', p.width / 2 + p.textWidth('.'), p.height / 2 + 60);
    if (p.frameCount % 30 < 15) {
      p.stroke(alive);
      p.line(p.width / 2, p.height / 2 + 30, p.width / 2, p.height / 2 + 60);
      p.noStroke();
    }
    p.textAlign(p.RIGHT);
    p.text(input, p.width / 2, p.height / 2 + 60);
    p.textSize(10);
    p.textAlign(p.LEFT);
    p.text('Original Game of Life was developed by John Conway in 1970.', 10, p.height - 10);
  }

  function showPaste() {
    if (!copy) return;
    const [ci, cj] = cellAt(p.mouseX, p.mouseY);
    const ctx = p.drawingContext;
    ctx.fillStyle = 'rgba(230,230,230,0.3)';
    ctx.fillRect(ci * CELL, cj * CELL, copy.length * CELL, copy[0].length * CELL);
    ctx.fillStyle = alive;
    for (let i = 0; i < copy.length; i++)
      for (let j = 0; j < copy[0].length; j++) if (copy[i][j]) ctx.fillRect((ci + i) * CELL, (cj + j) * CELL, CELL, CELL);
  }

  function showSelection() {
    if (startX === -1) return;
    const x0 = Math.min(startX, endX);
    const y0 = Math.min(startY, endY);
    const ctx = p.drawingContext;
    ctx.fillStyle = 'rgba(230,230,230,0.3)';
    ctx.strokeStyle = '#fff';
    ctx.fillRect(x0 * CELL, y0 * CELL, (Math.abs(endX - startX) + 1) * CELL, (Math.abs(endY - startY) + 1) * CELL);
    ctx.strokeRect(x0 * CELL + 0.5, y0 * CELL + 0.5, (Math.abs(endX - startX) + 1) * CELL, (Math.abs(endY - startY) + 1) * CELL);
  }

  // ---- copy/paste --------------------------------------------------------

  function cellAt(x, y) {
    return [
      Math.min(numX - 1, Math.max(0, Math.floor(x / CELL))),
      Math.min(numY - 1, Math.max(0, Math.floor(y / CELL))),
    ];
  }

  function finishCopy() {
    const x0 = Math.min(startX, endX);
    const x1 = Math.max(startX, endX);
    const y0 = Math.min(startY, endY);
    const y1 = Math.max(startY, endY);
    copy = [];
    for (let i = x0; i <= x1; i++) {
      const col = [];
      for (let j = y0; j <= y1; j++) col.push(cells[idx(i, j)]);
      copy.push(col);
    }
    startX = startY = endX = endY = -1;
  }

  function paste(x, y) {
    if (!copy) return;
    const [ci, cj] = cellAt(x, y);
    for (let i = 0; i < copy.length && ci + i < numX; i++)
      for (let j = 0; j < copy[0].length && cj + j < numY; j++) if (copy[i][j]) cells[idx(ci + i, cj + j)] = 1;
    dirty = true;
  }

  const transpose = (m) => m[0].map((_, j) => m.map((col) => col[j]));
  const rotateCW = () => (copy = transpose(copy).map((col) => col.slice().reverse()));
  const rotateCCW = () => (copy = transpose(copy.slice().reverse()));
  const flip = () => (copy = copy.map((col) => col.slice().reverse()));

  // ---- modes -----------------------------------------------------------------

  function enterEdit() {
    lastEditInput = performance.now();
    if (mode === 'edit') return;
    mode = 'edit';
    p.cancelScheduled();
    holdScheduled = false;
    stagnant = false;
    pause = true;
    p.frameRate(30);
    p.loop();
    hudFade.wake();
  }

  function enterAmbient() {
    mode = 'ambient';
    gettingProb = pasting = false;
    startX = startY = endX = endY = -1;
    pause = false;
    history.length = 0;
    stagnant = false;
    holdScheduled = false;
    p.cursor(p.ARROW);
    p.frameRate(10);
    dirty = true;
    p.loop();
  }

  function reseedAmbient() {
    probability = Math.floor(18 + Math.random() * 18);
    setCells(probability);
    p.loop();
  }

  function helpText() {
    if (mode !== 'edit') return '';
    if (gettingProb) return 'type a percentage, Enter to start';
    if (pasting) return 'PASTE  arrows rotate/flip · click to stamp · Esc done';
    return `EDIT ${pause ? '(paused)' : '(running)'}  space run/pause · click/drag cells · right-drag copy · p paste · r reseed · c clear · n new · m ambient`;
  }

  // ---- p5 --------------------------------------------------------------------

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(10);
    loadFont();
    p.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    hud = createHud(p.canvas.parentElement);
    const panel = createPanel(p.canvas.parentElement, { title: 'Game of Life', toggleLabel: 'Colors' });
    panel.toggle.classList.add('corner-br');
    panel.el.classList.add('corner-br');
    panel.color('Living cells', alive, (v) => {
      alive = v;
      dirty = true;
      p.loop();
      try {
        localStorage.setItem(COLOR_KEY, v);
      } catch {
        // storage unavailable
      }
    });
    panel.buttons([
      ['Default color', () => {
        alive = DEFAULT_COLOR;
        panel.el.querySelector('input[type=color]').value = alive;
        localStorage.removeItem(COLOR_KEY);
        dirty = true;
        p.loop();
      }],
      ['Hide', () => panel.hide()],
    ]);
    hudFade = autoFade([hud.el, panel.el, panel.toggle], 10_000);
    allocate();
    reseedAmbient();
  };

  p.draw = () => {
    hud.set(helpText());

    if (mode === 'edit' && performance.now() - lastEditInput > EDIT_IDLE_MS) enterAmbient();

    if (mode === 'ambient') {
      if (stagnant) {
        if (!holdScheduled) {
          holdScheduled = true;
          p.schedule(reseedAmbient, HOLD_MS);
        }
        p.noLoop();
        return;
      }
      if (dirty) {
        displayCells();
        dirty = false;
      }
      nextTick();
      const h = hash();
      if (history.includes(h) || generation > MAX_GENERATIONS) stagnant = true;
      history.push(h);
      if (history.length > HISTORY) history.shift();
      return;
    }

    // ---- edit mode (original draw loop)
    if (gettingProb) {
      textScreen();
      return;
    }
    if (!pause) {
      if (tickToggle % 6 === 0) {
        nextTick();
        tickToggle = 0;
      }
      tickToggle++;
    }
    displayCells();
    if (pause && pasting) showPaste();
    showSelection();
  };

  p.onActivate = () => {
    holdScheduled = false;
  };

  // mouse ---------------------------------------------------------------------

  p.mousePressed = () => {
    enterEdit();
    dragged = false;
    if (p.mouseButton === p.RIGHT && pause && !pasting) {
      selecting = true;
      [startX, startY] = cellAt(p.mouseX, p.mouseY);
      [endX, endY] = [startX, startY];
    }
    return false;
  };

  p.mouseMoved = () => {
    const [i, j] = cellAt(p.mouseX, p.mouseY);
    drawMode = cells[idx(i, j)] === 0;
  };

  p.mouseDragged = () => {
    lastEditInput = performance.now();
    dragged = true;
    if (!pause || mode !== 'edit') return;
    if (selecting) {
      [endX, endY] = cellAt(p.mouseX, p.mouseY);
      return;
    }
    if (pasting || gettingProb) return;
    const [i, j] = cellAt(p.mouseX, p.mouseY);
    if (px !== i || py !== j) {
      cells[idx(i, j)] = drawMode ? 1 : 0;
      dirty = true;
    }
    px = i;
    py = j;
  };

  p.mouseReleased = () => {
    if (mode !== 'edit') return;
    if (selecting) {
      selecting = false;
      finishCopy();
      return false;
    }
    if (p.mouseButton === p.LEFT && pasting) {
      paste(p.mouseX, p.mouseY);
    } else if (p.mouseButton === p.LEFT && pause && !dragged && !gettingProb) {
      const [i, j] = cellAt(p.mouseX, p.mouseY);
      cells[idx(i, j)] = cells[idx(i, j)] ? 0 : 1;
      dirty = true;
    }
    dragged = false;
    px = py = -1;
    return false;
  };

  // keyboard ----------------------------------------------------------------

  p.keyPressed = (e) => {
    if (e?.metaKey || e?.ctrlKey || e?.altKey) return; // leave browser shortcuts alone
    enterEdit();
    const key = p.key;

    if (gettingProb) {
      if (p.keyCode === p.ENTER || p.keyCode === p.RETURN) {
        if (input === '') return false;
        probability = Number(input);
        setCells(probability);
        pause = probability === 0;
        gettingProb = false;
      } else if (key >= '0' && key <= '9') {
        if (Number(input + key) <= 100) input += key;
      } else if (p.keyCode === p.BACKSPACE || p.keyCode === p.DELETE) {
        input = input.slice(0, -1);
      }
      return false;
    }

    if (pasting) {
      if (p.keyCode === p.ESCAPE) pasting = false;
      else if (copy && p.keyCode === p.LEFT_ARROW) rotateCCW();
      else if (copy && p.keyCode === p.RIGHT_ARROW) rotateCW();
      else if (copy && (p.keyCode === p.UP_ARROW || p.keyCode === p.DOWN_ARROW)) flip();
    }

    switch (key.toLowerCase()) {
      case 'r':
        setCells(probability);
        break;
      case 'c':
        cells.fill(0);
        dirty = true;
        pause = true;
        break;
      case 'p':
        if (copy) {
          pasting = true;
          pause = true;
        }
        break;
      case 'n':
        gettingProb = true;
        input = '';
        break;
      case 'm':
        enterAmbient();
        break;
      case ' ':
        pause = !pause;
        pasting = false;
        break;
      default:
        break;
    }
    return false;
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    allocate();
    history.length = 0;
    stagnant = false;
    p.loop();
  };
}
