// Gear Train  (new: a gear sandbox)
//
// An amber motor gear sits somewhere on the board, turning at a random 2-8
// RPM. Drag gears out of the palette (five sizes and two compounds) and drop
// them anywhere; near another gear they snap to the exact meshing distance
// and slide around its rim. Driven gears turn at the ratio of their teeth and
// alternate direction down the chain. There are two layers: a gear takes the
// layer of the ring it meshes with, so a compound passes motion from one layer
// to the other, and front gears cast a soft shadow on the back. Overlapping a
// gear on the same layer is refused (red ghost). The Belt tool links two
// distant gears so they turn the same way. An odd loop, or any other pair of
// paths asking a gear for different speeds, locks the whole train: it
// shudders to a stop and the clashing meshes glow red until a gear is taken
// out. Drag a gear to move it, or drop it on the panel to delete it.
//
// Goals (optional): 1-3 fixed target gears, each wanting a direction and a
// speed relative to the motor. They come from a hidden train grown from the
// motor, so every board is solvable. Match them all for a short celebration
// and a new board.
//
// Ambient mode: an invisible builder takes over the current board, hanging a
// gear (now and then a compound or a belted gear) on the turning train every
// 2-4 s, never where it would jam. When the board is full it holds, takes the
// gears away one at a time, and starts a new board. With goals on, it builds
// the hidden solution instead. Settings: gear scale, motor speed, goals, and
// whether ambient mode is allowed (off keeps it interactive, so the builder
// never touches your machine); remembered per browser, except the speed.

import { createPanel, autoFade } from '../../lib/panel.js';
import { snap, beltOk, beltHit, beltCrosses, outerR, pitchR, hubR, gearPath, clearPathCache } from './geometry.js';
import { solve } from './drive.js';
import { SIZES, COMPOUNDS, MAX_GEARS, MAX_BELTS, makeGear, makeSource, makeGoals, growStep } from './builder.js';
import { drawBoard, COLORS } from './render.js';

const SCALE_KEY = 'iw:gears:module';
const GOALS_KEY = 'iw:gears:goals';
const AMBIENT_KEY = 'iw:gears:ambient';
const TAU = Math.PI * 2;
const GROW = 1 / 0.3; // scale per second for gears appearing / leaving
const SHAKE_MS = 800;
const HOLD_MS = 20_000; // builder pause on a full board before clearing it
const SOLVED_HOLD_MS = 5000;
const GOAL_GIVEUP_MS = 15_000;
const WAKE_MS = 16_000; // just past the interaction timeout

export default function gearTrain(p) {
  let m = 6;
  let goals = false;
  let allowAmbient = true;
  try {
    m = Number(localStorage.getItem(SCALE_KEY)) || m;
    goals = localStorage.getItem(GOALS_KEY) === '1';
    allowAmbient = localStorage.getItem(AMBIENT_KEY) !== '0';
  } catch {
    // storage unavailable
  }
  const save = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage unavailable
    }
  };

  const board = { gears: [], belts: [], edges: [], m, w: 0, h: 0, theta: 0, omega: 0, jammed: false, nextId: 1, avoid: null, beltDash: [] };
  let hidden = []; // goal solution: [{ teeth, layers, x, y }]
  let solvedAt = 0;
  let shakeAt = 0;
  let wasJammed = false;
  let drag = null; // { teeth, gear, belts, dx, dy, ghost }
  let hover = null;
  let pointer = null;
  let beltMode = false;
  let beltStart = null;
  let wakePending = false;
  let ai = { phase: 'build', cooldown: 45, fails: 0, until: 0 };
  let panel;
  let speedCtl;
  let beltBtn;

  // ---- board -----------------------------------------------------------------

  function avoidRect() {
    if (!panel) return null;
    const c = p.canvas.getBoundingClientRect();
    let box = null;
    for (const el of [panel.el, panel.toggle]) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const x0 = r.left - c.left - 16;
      const y0 = r.top - c.top - 16;
      const x1 = r.right - c.left + 16;
      const y1 = r.bottom - c.top + 16;
      box = box
        ? { x: Math.min(box.x, x0), y: Math.min(box.y, y0), w: Math.max(box.x + box.w, x1) - Math.min(box.x, x0), h: Math.max(box.y + box.h, y1) - Math.min(box.y, y0) }
        : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    return box;
  }

  function generate() {
    board.w = p.width;
    board.h = p.height;
    board.m = m;
    board.beltDash = [m * 1.2, m * 1.2];
    board.gears = [];
    board.belts = [];
    board.theta = 0;
    board.avoid = avoidRect();
    const source = makeSource(board);
    source.scale = 1;
    board.gears.push(source);
    const rpm = Math.round((2 + Math.random() * 6) * 2) / 2;
    board.omega = (Math.random() < 0.5 ? -1 : 1) * rpm * (TAU / 60);
    speedCtl?.set(rpm);
    hidden = [];
    if (goals) {
      for (let tries = 0; tries < 20; tries++) {
        const made = makeGoals(board);
        if (!made) continue;
        board.gears.push(...made.targets);
        solve(board);
        if (made.targets.every((t) => !t.driven) && !board.edges.some((e) => e.bad)) {
          hidden = made.hidden;
          break;
        }
        board.gears = [source];
      }
    }
    solve(board);
    solvedAt = 0;
    wasJammed = false;
    beltStart = null;
    hover = null;
    ai = { phase: 'build', cooldown: 45, fails: 0, until: 0 };
    p.loop();
  }

  function kill(g) {
    g.dying = true;
    board.belts = board.belts.filter((bl) => bl.a !== g && bl.b !== g);
    if (hover === g) hover = null;
    if (beltStart === g) beltStart = null;
    solve(board);
  }

  function clearBoard() {
    board.gears = board.gears.filter((g) => g.fixed);
    board.belts = [];
    hover = null;
    beltStart = null;
    solve(board);
    p.loop();
  }

  const targets = () => board.gears.filter((g) => g.fixed === 'target');

  // ---- ambient builder -------------------------------------------------------

  function blocks(g, spec) {
    const d = Math.hypot(g.x - spec.x, g.y - spec.y);
    if (d < hubR(m) * 2) return true;
    for (const ring of g.rings) {
      for (let i = 0; i < spec.teeth.length; i++) {
        if (ring.layer === spec.layers[i] && d < pitchR(ring.teeth, m) + pitchR(spec.teeth[i], m) + 2 * m) return true;
      }
    }
    return false;
  }

  // replay the hidden solution, clearing any of the user's gears in its way
  function goalStep(now) {
    const idx = hidden.findIndex((_, i) => !board.gears.some((g) => g.hid === i && !g.dying));
    if (idx < 0) {
      if (!ai.until) ai.until = now + GOAL_GIVEUP_MS;
      else if (now > ai.until) generate();
      return;
    }
    const spec = hidden[idx];
    const blocker = board.gears.find((g) => !g.fixed && !g.dying && g.hid === undefined && blocks(g, spec));
    if (blocker) {
      kill(blocker);
      return;
    }
    const r = outerR(Math.max(...spec.teeth), m) + m * 0.5;
    const belt = board.belts.find((bl) => beltCrosses(board, bl, spec.x, spec.y, r));
    if (belt) {
      board.belts = board.belts.filter((bl) => bl !== belt);
      solve(board);
      return;
    }
    const g = makeGear(board, spec.teeth, spec.layers, spec.x, spec.y);
    g.hid = idx;
    board.gears.push(g);
    solve(board);
  }

  function aiTick(now) {
    if (--ai.cooldown > 0) return;
    board.avoid = avoidRect();
    if (hidden.length) {
      goalStep(now);
      ai.cooldown = 45 + Math.floor(Math.random() * 45);
      return;
    }
    if (ai.phase === 'build') {
      if (growStep(board)) ai.fails = 0;
      else ai.fails++;
      if (board.gears.length >= MAX_GEARS || ai.fails >= 8) {
        ai.phase = 'hold';
        ai.until = now + HOLD_MS;
      }
      ai.cooldown = 60 + Math.floor(Math.random() * 60);
    } else if (ai.phase === 'hold') {
      if (now > ai.until) ai.phase = 'clear';
      ai.cooldown = 15;
    } else {
      let victim = null;
      for (const g of board.gears) if (!g.fixed && !g.dying && (!victim || g.id > victim.id)) victim = g;
      if (victim) kill(victim);
      else if (!board.gears.some((g) => g.dying)) generate();
      ai.cooldown = 8;
    }
  }

  // ---- input -----------------------------------------------------------------

  const toCanvas = (e) => {
    const r = p.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function overPanel(e) {
    if (e.clientX < 0 || e.clientY < 0 || e.clientX > window.innerWidth || e.clientY > window.innerHeight) return true;
    for (const el of [panel.el, panel.toggle]) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return true;
    }
    return false;
  }

  function hitGear(x, y) {
    for (const layer of [1, 0]) {
      for (let i = board.gears.length - 1; i >= 0; i--) {
        const g = board.gears[i];
        if (g.dying) continue;
        for (const ring of g.rings) {
          if (ring.layer === layer && Math.hypot(x - g.x, y - g.y) < outerR(ring.teeth, m)) return g;
        }
      }
    }
    return null;
  }

  function startDrag(teeth, gear, e, dx = 0, dy = 0) {
    drag = { teeth, gear, belts: [], dx, dy, ghost: null };
    if (gear) {
      // lift it off the board: its meshes break until it lands again
      board.gears.splice(board.gears.indexOf(gear), 1);
      drag.belts = board.belts.filter((bl) => bl.a === gear || bl.b === gear);
      board.belts = board.belts.filter((bl) => !drag.belts.includes(bl));
      solve(board);
    }
    hover = null;
    beltStart = null;
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
    window.addEventListener('pointercancel', onDragEnd);
    onDragMove(e);
  }

  function onDragMove(e) {
    if (!drag) return;
    pointer = toCanvas(e);
    drag.ghost = overPanel(e) ? null : { ...snap(board, drag.teeth, pointer.x + drag.dx, pointer.y + drag.dy), teeth: drag.teeth };
    p.loop();
  }

  function onDragEnd(e) {
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
    window.removeEventListener('pointercancel', onDragEnd);
    if (!drag) return;
    const { gear, ghost } = drag;
    const remove = e.type === 'pointerup' && overPanel(e);
    if (!remove && ghost && ghost.ok && (gear || board.gears.length < MAX_GEARS)) {
      const g = gear || makeGear(board, drag.teeth, ghost.layers, ghost.x, ghost.y);
      g.x = ghost.x;
      g.y = ghost.y;
      g.rings.forEach((r, i) => (r.layer = ghost.layers[i]));
      if (!gear) g.scale = 0.7;
      board.gears.push(g);
      for (const bl of drag.belts) if (beltOk(board, bl.a, bl.b)) board.belts.push(bl);
    } else if (!remove && gear) {
      board.gears.push(gear); // dropped somewhere invalid: put it back
      board.belts.push(...drag.belts);
    }
    drag = null;
    solve(board);
    p.loop();
  }

  function onPointerDown(e) {
    if (e.button !== 0 || drag) return;
    const pt = toCanvas(e);
    const g = hitGear(pt.x, pt.y);
    if (beltMode) {
      if (g && !beltStart) beltStart = g;
      else if (g && g !== beltStart) {
        if (board.belts.length < MAX_BELTS && beltOk(board, beltStart, g)) {
          board.belts.push({ a: beltStart, b: g });
          solve(board);
        }
        beltStart = null;
      } else if (g) beltStart = null;
      else {
        const bl = board.belts.find((b) => beltHit(board, b, pt.x, pt.y));
        if (bl) {
          board.belts = board.belts.filter((b) => b !== bl);
          solve(board);
        }
        beltStart = null;
      }
      p.loop();
      return;
    }
    if (g && !g.fixed) startDrag(g.rings.map((r) => r.teeth), g, e, g.x - pt.x, g.y - pt.y);
  }

  function onPointerMove(e) {
    if (drag) return;
    pointer = toCanvas(e);
    hover = hitGear(pointer.x, pointer.y);
    p.loop();
  }

  function setBeltMode(v) {
    beltMode = v;
    beltStart = null;
    beltBtn.classList.toggle('active', v);
    p.canvas.style.cursor = v ? 'crosshair' : '';
    p.loop();
  }

  // ---- panel -----------------------------------------------------------------

  function swatch(teeth) {
    const el = document.createElement('div');
    el.className = 'swatch';
    el.title = teeth.length > 1 ? `Compound ${teeth[0]}/${teeth[1]} teeth` : `${teeth[0]} teeth`;
    const cv = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    cv.width = cv.height = 44 * dpr;
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.translate(22, 22);
    const mi = 19 / (Math.max(...teeth) / 2 + 1);
    teeth.forEach((t, i) => {
      ctx.fillStyle = i ? COLORS.frontLit : COLORS.backLit;
      ctx.fill(gearPath(t, mi), 'evenodd');
    });
    const cap = document.createElement('span');
    cap.textContent = teeth.join('/');
    el.append(cv, cap);
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (beltMode) setBeltMode(false);
      startDrag(teeth.slice(), null, e);
    });
    return el;
  }

  function buildPanel() {
    panel = createPanel(p.canvas.parentElement, { title: 'Gear Train', toggleLabel: 'Gears' });
    panel.toggle.classList.add('corner-br');
    panel.el.classList.add('corner-br');
    const pal = document.createElement('div');
    pal.className = 'gear-palette';
    for (const t of SIZES) pal.append(swatch([t]));
    for (const c of COMPOUNDS) pal.append(swatch(c));
    beltBtn = document.createElement('button');
    beltBtn.type = 'button';
    beltBtn.className = 'swatch belt';
    beltBtn.textContent = 'Belt';
    beltBtn.title = 'Click two gears to link them; click a belt to remove it';
    beltBtn.addEventListener('click', () => setBeltMode(!beltMode));
    pal.append(beltBtn);
    panel.el.append(pal);
    // the swatch icons used a throwaway module; drop those shapes
    clearPathCache();

    panel.range('Gear scale', { min: 4, max: 10, step: 1, value: m, format: (v) => `${v}px teeth` }, (v) => {
      m = v;
      save(SCALE_KEY, String(v));
      clearPathCache();
      generate();
    });
    speedCtl = panel.range('Motor speed', { min: 1, max: 12, step: 0.5, value: 4, format: (v) => `${v} RPM` }, (v) => {
      board.omega = Math.sign(board.omega || 1) * v * (TAU / 60);
      p.loop();
    });
    panel.checkbox('Goals', goals, (v) => {
      goals = v;
      save(GOALS_KEY, v ? '1' : '0');
      generate();
    });
    panel.checkbox('Allow ambient mode', allowAmbient, (v) => {
      allowAmbient = v;
      save(AMBIENT_KEY, v ? '1' : '0');
      p.loop();
    });
    panel.buttons([
      ['New board', generate],
      ['Clear', clearBoard],
      ['Hide', () => panel.hide()],
    ]);
    panel.note('Drag a gear onto the board; drop it back here to remove it. Belt: click two gears.');
    autoFade([panel.el, panel.toggle], 10_000);
  }

  // ---- p5 --------------------------------------------------------------------

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(30);
    p.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    p.canvas.addEventListener('pointerdown', onPointerDown);
    p.canvas.addEventListener('pointermove', onPointerMove);
    p.canvas.addEventListener('pointerleave', () => {
      hover = null;
      pointer = null;
      p.loop();
    });
    buildPanel();
    generate();
  };

  p.draw = () => {
    const now = performance.now();
    const dt = Math.min(p.deltaTime, 100) / 1000;
    const live = !allowAmbient || p.interactive();

    if (!board.jammed) board.theta += board.omega * dt;
    if (board.jammed && !wasJammed) shakeAt = now;
    wasJammed = board.jammed;

    let animating = false;
    let gone = false;
    for (const g of board.gears) {
      if (g.dying) {
        g.scale -= GROW * dt;
        if (g.scale <= 0) gone = true;
        animating = true;
      } else if (g.scale < 1) {
        g.scale = Math.min(1, g.scale + GROW * dt);
        animating = true;
      }
    }
    if (gone) board.gears = board.gears.filter((g) => !(g.dying && g.scale <= 0));

    const goalsNow = targets();
    for (const t of goalsNow) t.matched = !board.jammed && t.driven && Math.abs(t.k - t.want) < 1e-6 * Math.max(1, Math.abs(t.want));
    if (goalsNow.length && !solvedAt && goalsNow.every((t) => t.matched)) solvedAt = now;
    if (solvedAt && now - solvedAt > SOLVED_HOLD_MS) generate();

    if (!live && !solvedAt && !drag) aiTick(now);
    else if (live && ai.phase !== 'build') ai = { phase: 'build', cooldown: 45, fails: 0, until: 0 };

    const since = now - shakeAt;
    const shake = board.jammed && since < SHAKE_MS ? 0.05 * Math.sin(since * 0.045) * Math.exp(-since / 160) : 0;
    drawBoard(p, board, {
      shake,
      hover,
      ghost: drag && drag.ghost,
      beltMode,
      beltStart,
      pointer,
      celebrate: solvedAt ? (now - solvedAt) / 1000 : 0,
    });

    // settle when nothing can move: a locked (or stopped) train with no
    // animation, drag or builder; input or the wake timer starts it again
    const turning = !board.jammed && board.omega !== 0;
    if (!turning && !animating && !drag && !shake && !solvedAt && live) {
      p.noLoop();
      if (allowAmbient && !wakePending) {
        wakePending = true;
        p.schedule(() => {
          wakePending = false;
          p.loop();
        }, WAKE_MS);
      }
    }
  };

  p.keyPressed = () => {
    if (p.key === 'Escape' && beltMode) setBeltMode(false);
  };

  p.onActivate = () => {
    wakePending = false;
    p.redraw();
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    generate();
  };
}
