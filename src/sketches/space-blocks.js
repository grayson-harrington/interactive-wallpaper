// Space Blocks  (Processing Android/space_blocks)
//
// Colored blocks drift through space; tapping creates a gravity pool (tap an
// existing pool to feed it). Blocks that linger in a pool shrink and are
// absorbed, growing the pool. Holding a touch also pulls every block toward
// the finger. The original's slide-out toggle menu is replaced by a control
// panel + key bar (same pattern as Game of Life): choose what a click does
// (add pools / add blocks / remove blocks / remove pools), damping, clear.
//
// Attract mode (default / Plash): the game plays itself by feeding its own
// touch handlers scripted input - tapping to create and feed pools, holding
// to pull blocks around, dropping in new blocks - with a faint ring showing
// the invisible finger. When space empties it resets.
// Playable mode: real mouse input takes over immediately. Keys: 1-4 click
// mode, c clear pools, -/= remove/add block, d damping, n clear everything,
// space pool at the cursor.

const gConstant = 0.08;
const maxMassSpace = 1000;
const maxMass = 1500;
const massAdd = 8;
const maxDist = 5000;
const backFill = 45;
const STEPS_PER_FRAME = 2; // physics tuned for 60Hz on the phone; draw at 30
const SIM_RATE = 60;
const PULL = 0.06; // acceleration toward a held mouse, px/step^2

import { createHud, createPanel, autoFade } from '../lib/panel.js';

const CLICK_MODES = [
  ['pooling', 'add gravity pools'],
  ['blocking', 'add blocks'],
  ['deblocking', 'remove blocks'],
  ['depooling', 'remove all pools'],
];

const rand = (a, b) => a + Math.random() * (b - a);

export default function spaceBlocks(p) {
  let blocks = [];
  let pools = [];
  const modes = { blocking: false, deblocking: false, pooling: true, depooling: false, damp: false };
  const input = { x: 0, y: 0, pressed: false };
  let hud;
  let modeSelect;
  let dampButton;
  let script = { cooldown: 60, action: null, emptyFor: 0 };

  // ---- entities --------------------------------------------------------------

  const minDim = () => Math.min(p.width, p.height);

  function makeBlock(x, y, moving) {
    const bWidth = rand(minDim() / 15, minDim() / 10);
    const a = Math.random() * Math.PI * 2;
    return {
      x: x ?? rand(bWidth, p.width - bWidth),
      y: y ?? rand(bWidth, p.height - bWidth),
      vx: moving ? Math.cos(a) * 2 : 0,
      vy: moving ? Math.sin(a) * 2 : 0,
      bWidth,
      mass: (bWidth * bWidth) / 400,
      cornerR: bWidth / 3,
      shrink: false,
      poolShrinkIn: null,
      framesInPool: 0,
      c: [rand(0, 255), rand(0, 255), rand(0, 255)].map(Math.floor),
    };
  }

  function makePool(x, y) {
    const size = minDim() / 25;
    return { x, y, xoff: 0, step: 0.01, gravityPoolSize: size, diameter: size / 2, mass: 100, minDist: size };
  }

  function poolContains(pool, x, y) {
    return Math.hypot(x - pool.x, y - pool.y) < pool.diameter / 2;
  }

  function feedPool(pool) {
    if (pool.mass < maxMassSpace) {
      pool.gravityPoolSize += massAdd / 10;
      pool.mass += massAdd;
    }
  }

  function absorb(pool, b) {
    pool.gravityPoolSize += b.mass / 10;
    pool.mass = Math.min(maxMass, pool.mass + b.mass);
    pool.minDist = pool.gravityPoolSize;
  }

  function updateBlock(b) {
    const damping = modes.damp ? 0.003 : 0;
    let ax = 0;
    let ay = 0;
    if (input.pressed && !modes.blocking) {
      // The phone original used 100*g/dist^2, which is imperceptible at
      // desktop distances; a steady pull makes "hold to pull" actually work.
      const dist = Math.max(5, Math.hypot(input.x - b.x, input.y - b.y));
      ax = ((input.x - b.x) / dist) * PULL;
      ay = ((input.y - b.y) / dist) * PULL;
    }
    for (const pool of pools) {
      let dist = Math.hypot(pool.x - b.x, pool.y - b.y);
      if (b.poolShrinkIn === pool) b.framesInPool = dist < pool.minDist ? b.framesInPool + 1 : 0;
      else if (dist < pool.minDist) b.poolShrinkIn = pool;
      if (b.framesInPool > SIM_RATE * (1 + pool.gravityPoolSize / 100)) {
        b.poolShrinkIn ??= pool;
        b.shrink = true;
      }
      dist = Math.max(dist, pool.minDist);
      ax += ((pool.x - b.x) / dist / dist) * pool.mass * gConstant;
      ay += ((pool.y - b.y) / dist / dist) * pool.mass * gConstant;
    }
    b.vx = (b.vx + ax) * (1 - damping);
    b.vy = (b.vy + ay) * (1 - damping);
    b.x += b.vx;
    b.y += b.vy;

    if (pools.length === 0 && !input.pressed) {
      const h = b.bWidth / 2;
      if (b.x < h) (b.x = h), (b.vx *= -1);
      if (b.x > p.width - h) (b.x = p.width - h), (b.vx *= -1);
      if (b.y < h) (b.y = h), (b.vy *= -1);
      if (b.y > p.height - h) (b.y = p.height - h), (b.vy *= -1);
    }

    if (b.shrink) {
      b.bWidth--;
      const t = Math.floor(b.poolShrinkIn.gravityPoolSize / 5);
      for (let i = 0; i < t; i++) {
        b.vx *= 1 - damping;
        b.vy *= 1 - damping;
      }
    }
  }

  function step() {
    const keep = [];
    for (const b of blocks) {
      updateBlock(b);
      const far = Math.hypot(b.x - p.width / 2, b.y - p.height / 2) > maxDist;
      if (b.shrink && b.bWidth < 2) absorb(b.poolShrinkIn, b);
      else if (!far) keep.push(b);
    }
    blocks = keep;
  }

  // ---- touch handlers (user_input.pde), shared by real and scripted input ----

  function setClickMode(name) {
    for (const [m] of CLICK_MODES) modes[m] = m === name;
    if (modeSelect) modeSelect.value = name;
  }

  const clickMode = () => CLICK_MODES.find(([m]) => modes[m])?.[0] ?? 'pooling';

  function setDamp(on) {
    modes.damp = on;
    if (dampButton) dampButton.textContent = `Damping: ${on ? 'on' : 'off'}`;
  }

  function clearAll() {
    blocks = [];
    pools = [];
  }

  function touchStarted(x, y) {
    input.x = x;
    input.y = y;
    input.pressed = true;
    if (modes.pooling) {
      const hit = pools.find((pool) => poolContains(pool, x, y));
      if (hit) feedPool(hit);
      else pools.push(makePool(x, y));
    }
  }

  // Dragging only moves the pull point; pools grow by absorbing blocks (or a
  // deliberate tap on a pool), not by being swept over.
  function touchMoved(x, y) {
    input.x = x;
    input.y = y;
  }

  function touchEnded(x, y) {
    input.pressed = false;
    if (modes.blocking) blocks.push(makeBlock(x, y, false));
    else if (modes.deblocking) blocks.shift();
    else if (modes.depooling) pools = [];
  }

  // ---- attract-mode script -------------------------------------------------

  function reset() {
    blocks = Array.from({ length: 5 }, () => makeBlock(undefined, undefined, true));
    pools = [];
    setClickMode('pooling');
    setDamp(false);
  }

  function randomSpot(margin = 0.15) {
    return [rand(p.width * margin, p.width * (1 - margin)), rand(p.height * margin, p.height * (1 - margin))];
  }

  function runScript() {
    if (blocks.length === 0) {
      if (++script.emptyFor > 60) {
        reset();
        script.emptyFor = 0;
      }
      return;
    }
    script.emptyFor = 0;

    const a = script.action;
    if (a) {
      a.t++;
      if (a.kind === 'hold') {
        // the finger drifts a little while held
        const x = a.x + Math.sin(a.t * 0.05) * a.drift;
        const y = a.y + Math.cos(a.t * 0.04) * a.drift;
        if (a.t % 12 === 0) touchMoved(x, y);
        input.x = x;
        input.y = y;
      }
      if (a.t >= a.len) {
        touchEnded(input.x, input.y);
        script.action = null;
        script.cooldown = Math.floor(rand(60, 200));
      }
      return;
    }
    if (--script.cooldown > 0) return;

    const r = Math.random();
    if (blocks.length < 4 && r < 0.5) {
      // drop in a new drifting block
      blocks.push(makeBlock(undefined, undefined, true));
      script.cooldown = 60;
    } else if (pools.length >= 4 && r < 0.35) {
      pools = [];
      script.cooldown = 120;
    } else if (pools.length > 0 && r < 0.55) {
      // feed an existing pool with a few taps
      const pool = pools[Math.floor(Math.random() * pools.length)];
      touchStarted(pool.x, pool.y);
      script.action = { kind: 'tap', x: pool.x, y: pool.y, t: 0, len: 10 };
    } else {
      const [x, y] = randomSpot();
      touchStarted(x, y);
      const hold = Math.random() < 0.45;
      script.action = hold
        ? { kind: 'hold', x, y, t: 0, len: Math.floor(rand(60, 160)), drift: rand(10, 60) }
        : { kind: 'tap', x, y, t: 0, len: 8 };
    }
  }

  // ---- p5 --------------------------------------------------------------------

  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.frameRate(SIM_RATE / STEPS_PER_FRAME);
    buildControls();
    reset();
  };

  p.draw = () => {
    const live = p.interactive();
    if (live && script.action) {
      // a person took over mid-gesture: lift the scripted finger
      input.pressed = false;
      script.action = null;
    }
    for (let s = 0; s < STEPS_PER_FRAME; s++) {
      if (!live) runScript();
      step();
    }

    p.background(backFill);
    for (const pool of pools) {
      pool.diameter = p.map(p.noise(pool.xoff) * pool.gravityPoolSize, 0, pool.gravityPoolSize, (pool.gravityPoolSize * 2) / 3, pool.gravityPoolSize);
      pool.xoff += pool.step * STEPS_PER_FRAME;
      p.fill(200);
      p.stroke(200);
      p.strokeWeight(3);
      p.ellipse(pool.x, pool.y, pool.diameter, pool.diameter);
    }
    p.rectMode(p.CENTER);
    p.strokeWeight(3);
    p.stroke(255);
    for (const b of blocks) {
      p.fill(...b.c, 230);
      p.rect(b.x, b.y, b.bWidth, b.bWidth, b.cornerR);
    }

    if (!live && input.pressed) {
      p.noFill();
      p.stroke(255, 60);
      p.strokeWeight(2);
      p.ellipse(input.x, input.y, 40, 40);
    }

    hud.set(
      live
        ? `SPACE BLOCKS  click: ${CLICK_MODES.find(([m]) => m === clickMode())[1]} · hold mouse: pull blocks to cursor · 1-4 click mode · = / - add/remove block · c clear pools · n clear all · d damping`
        : '',
    );
  };

  p.mousePressed = () => touchStarted(p.mouseX, p.mouseY);
  p.mouseDragged = () => touchMoved(p.mouseX, p.mouseY);
  p.mouseReleased = () => touchEnded(p.mouseX, p.mouseY);

  function buildControls() {
    const parent = p.canvas.parentElement;
    hud = createHud(parent);
    const panel = createPanel(parent, { title: 'Space Blocks', toggleLabel: 'Controls' });
    panel.toggle.classList.add('corner-br');
    panel.el.classList.add('corner-br');
    modeSelect = panel.select(
      'Click does',
      CLICK_MODES.map(([value, label]) => ({ value, label })),
      clickMode(),
      setClickMode,
    );
    panel.buttons([
      ['Add block', () => blocks.push(makeBlock(undefined, undefined, true))],
      ['Clear pools', () => (pools = [])],
      ['Clear all', clearAll],
    ]);
    dampButton = panel.buttons([['Damping: off', () => setDamp(!modes.damp)]]).querySelector('button');
    panel.buttons([['Hide', () => panel.hide()]]);
    panel.note('Hold the mouse button down anywhere and every block is pulled toward the cursor. Blocks that linger inside a pool shrink and are absorbed, which is how pools grow (tapping a pool also feeds it).');
    autoFade([hud.el, panel.el, panel.toggle], 10_000);
  }

  p.keyPressed = () => {
    if ('1234'.includes(p.key)) {
      setClickMode(CLICK_MODES[Number(p.key) - 1][0]);
      return;
    }
    switch (p.key) {
      case 'c':
        pools = [];
        break;
      case '-':
        blocks.shift();
        break;
      case '=':
        blocks.push(makeBlock(undefined, undefined, true));
        break;
      case 'd':
        setDamp(!modes.damp);
        break;
      case 'n':
        clearAll();
        break;
      case ' ':
        pools.push(makePool(p.mouseX, p.mouseY));
        break;
      default:
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };
}
