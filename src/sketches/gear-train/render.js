// Drawing for Gear Train: the back layer, then the front layer over a soft
// offset shadow, belts on top, then jam glows, goal rings, labels and the
// drag ghost. Gears spinning faster than BLUR_RPM draw as a blurred disc
// instead of strobing teeth.

import { gearPath, pitchR, outerR, hubR, gearOuter, beltTangents } from './geometry.js';

const TAU = Math.PI * 2;
const BLUR_RPM = 120;

export const COLORS = {
  bg: '#101820',
  back: '#2b3946',
  backLit: '#44586a',
  front: '#384a59',
  frontLit: '#5a7184',
  source: '#e0a73f',
  axle: '#c3cfd9',
  shadow: 'rgba(0, 0, 0, 0.32)',
  belt: '#5d7386',
  beltDash: '#a4b8c8',
  jam: '#ff5a5a',
  target: '#8aa0b2',
  matched: '#7fe0a0',
  pick: '#9fd0ff',
  text: '#d6e0e8',
  pill: 'rgba(16, 24, 32, 0.82)',
};

const TARGET_DASH = [5, 5];
const NO_DASH = [];
const tan = {};

export const rpmOf = (g, omega) => (Math.abs(g.k * omega) * 60) / TAU;
export const angleOf = (g, theta) => g.k * theta + g.b;

const fmt = (v) => (v >= 10 ? v.toFixed(0) : String(Number(v.toFixed(2))));
const arrow = (w) => (w >= 0 ? '↻' : '↺');

export const teethLabel = (g) => (g.rings.length > 1 ? `${g.rings[0].teeth}/${g.rings[1].teeth}T` : `${g.rings[0].teeth}T`);

export function statusLabel(g, omega) {
  if (g.fixed === 'source') return `motor ${arrow(omega)} ${(Math.abs(omega) * 60 / TAU).toFixed(1)} RPM`;
  if (g.jammed) return 'jammed';
  if (!g.driven) return 'idle';
  return `${arrow(g.k * omega)} ${fmt(Math.abs(g.k))}×`;
}

export const goalLabel = (g, omega) => `${arrow(g.want * omega)} ${fmt(Math.abs(g.want))}×`;

function ringColor(g, layer) {
  if (g.fixed === 'source') return COLORS.source;
  if (layer === 0) return g.driven ? COLORS.backLit : COLORS.back;
  return g.driven ? COLORS.frontLit : COLORS.front;
}

function drawRing(ctx, g, ri, angle, board, color, top) {
  const { m } = board;
  const ring = g.rings[ri];
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(angle);
  if (g.scale !== 1) ctx.scale(g.scale, g.scale);
  ctx.fillStyle = color;
  if (g.driven && rpmOf(g, board.omega) > BLUR_RPM) {
    const r = pitchR(ring.teeth, m);
    ctx.beginPath();
    ctx.arc(0, 0, r - 1.25 * m, 0, TAU);
    ctx.arc(0, 0, hubR(m), 0, TAU, true);
    ctx.fill();
    ctx.globalAlpha *= 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, r + m, 0, TAU);
    ctx.arc(0, 0, r - 1.25 * m, 0, TAU, true);
    ctx.fill();
  } else {
    const clear = g.rings.length > 1 && ri === 0 ? outerR(g.rings[1].teeth, m) : 0;
    ctx.fill(gearPath(ring.teeth, m, clear), 'evenodd');
  }
  if (top) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.axle;
    ctx.beginPath();
    ctx.arc(0, 0, hubR(m) * 0.55, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawShadow(ctx, g, ri, angle, m) {
  ctx.save();
  ctx.translate(g.x + m * 0.5, g.y + m * 0.8);
  ctx.rotate(angle);
  if (g.scale !== 1) ctx.scale(g.scale, g.scale);
  ctx.fillStyle = COLORS.shadow;
  ctx.fill(gearPath(g.rings[ri].teeth, m), 'evenodd');
  ctx.restore();
}

// The ring a gear shows on top: its front-layer ring if it has one.
const topRing = (g) => (g.rings.length > 1 ? (g.rings[0].layer === 1 ? 0 : 1) : 0);

function drawLayer(ctx, board, layer, view) {
  const { gears, theta, m } = board;
  if (layer === 1) {
    for (const g of gears) {
      for (let ri = 0; ri < g.rings.length; ri++) {
        if (g.rings[ri].layer === 1) drawShadow(ctx, g, ri, angleOf(g, theta) + shakeOf(g, view), m);
      }
    }
  }
  for (const g of gears) {
    const a = angleOf(g, theta) + shakeOf(g, view);
    const top = topRing(g);
    for (let ri = 0; ri < g.rings.length; ri++) {
      if (g.rings[ri].layer !== layer) continue;
      drawRing(ctx, g, ri, a, board, ringColor(g, layer), ri === top);
    }
  }
}

const shakeOf = (g, view) => (view.shake && g.driven && g.jammed ? view.shake * (g.k >= 0 ? 1 : -1) : 0);

function drawBelts(ctx, board) {
  const { m, theta } = board;
  for (const bl of board.belts) {
    const { a, b } = bl;
    const t = beltTangents(a, b, m, tan);
    ctx.beginPath();
    ctx.moveTo(t.ax1, t.ay1);
    ctx.lineTo(t.bx1, t.by1);
    ctx.arc(b.x, b.y, t.r2, t.base + t.alpha, t.base - t.alpha, true);
    ctx.lineTo(t.ax2, t.ay2);
    ctx.arc(a.x, a.y, t.r1, t.base - t.alpha, t.base + t.alpha, true);
    ctx.closePath();
    ctx.lineWidth = m * 0.9;
    ctx.strokeStyle = COLORS.belt;
    ctx.stroke();
    // moving dashes show which way the belt runs (the path is drawn
    // counterclockwise on screen; a clockwise belt shifts the pattern back)
    ctx.setLineDash(board.beltDash);
    ctx.lineDashOffset = angleOf(a, theta) * t.r1;
    ctx.lineWidth = m * 0.35;
    ctx.strokeStyle = COLORS.beltDash;
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
}

function drawJams(ctx, board) {
  const { m } = board;
  for (const e of board.edges) {
    if (!e.bad) continue;
    const x = e.type === 'mesh' ? e.x : (e.a.x + e.b.x) / 2;
    const y = e.type === 'mesh' ? e.y : (e.a.y + e.b.y) / 2;
    ctx.fillStyle = 'rgba(255, 90, 90, 0.22)';
    ctx.beginPath();
    ctx.arc(x, y, m * 3.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.jam;
    ctx.beginPath();
    ctx.arc(x, y, m * 1.1, 0, TAU);
    ctx.fill();
  }
}

function label(ctx, text, x, y, color = COLORS.text) {
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = COLORS.pill;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 10, w, 20, 10);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

function drawTargets(ctx, board) {
  const { m } = board;
  ctx.setLineDash(TARGET_DASH);
  ctx.lineWidth = 1.5;
  for (const g of board.gears) {
    if (g.fixed !== 'target') continue;
    ctx.strokeStyle = g.matched ? COLORS.matched : COLORS.target;
    ctx.beginPath();
    ctx.arc(g.x, g.y, gearOuter(g, m) + m * 1.4, 0, TAU);
    ctx.stroke();
  }
  ctx.setLineDash(NO_DASH);
  for (const g of board.gears) {
    if (g.fixed !== 'target') continue;
    const text = goalLabel(g, board.omega) + (g.matched ? ' ✓' : '');
    label(ctx, text, g.x, g.y + gearOuter(g, m) + m * 1.4 + 16, g.matched ? COLORS.matched : COLORS.text);
  }
}

function drawGhost(ctx, board, ghost) {
  const { m } = board;
  const g = { x: ghost.x, y: ghost.y, rings: ghost.teeth.map((t, i) => ({ teeth: t, layer: ghost.layers[i] })), k: 0, b: 0, scale: 1 };
  ctx.globalAlpha = 0.6;
  for (const layer of [0, 1]) {
    for (let ri = 0; ri < g.rings.length; ri++) {
      if (g.rings[ri].layer !== layer) continue;
      const color = ghost.ok ? (layer ? COLORS.frontLit : COLORS.backLit) : COLORS.jam;
      drawRing(ctx, g, ri, 0, board, color, ri === topRing(g));
    }
  }
  ctx.globalAlpha = 1;
  if (ghost.ok) label(ctx, teethLabel(g), g.x, g.y - gearOuter(g, m) - 16);
}

// view: { shake, hover, ghost, beltMode, beltStart, pointer, celebrate }
export function drawBoard(p, board, view) {
  const ctx = p.drawingContext;
  const { m } = board;
  p.background(COLORS.bg);
  drawLayer(ctx, board, 0, view);
  drawLayer(ctx, board, 1, view);
  drawBelts(ctx, board);
  drawJams(ctx, board);
  drawTargets(ctx, board);

  if (view.beltMode && view.beltStart) {
    const g = view.beltStart;
    ctx.strokeStyle = COLORS.pick;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, gearOuter(g, m) + m, 0, TAU);
    ctx.stroke();
    if (view.pointer) {
      ctx.setLineDash(TARGET_DASH);
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(view.pointer.x, view.pointer.y);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
    }
  }
  if (view.hover && !view.ghost) {
    const g = view.hover;
    label(ctx, `${teethLabel(g)} · ${statusLabel(g, board.omega)}`, g.x, g.y - gearOuter(g, m) - 16);
  }
  if (view.ghost) drawGhost(ctx, board, view.ghost);
  if (view.celebrate) {
    ctx.fillStyle = `rgba(127, 224, 160, ${0.1 * Math.max(0, Math.sin(view.celebrate * 3))})`;
    ctx.fillRect(0, 0, p.width, p.height);
  }
}
