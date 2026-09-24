// App shell: dropdown, Daily Minimal thumbnail grid, auto-cycle, and the
// show/hide + loop/noLoop switching between sketches.
//
// URL parameters (handy for the Plash URL, where the menu may be unusable):
//   ?sketch=<id>&sub=<dm id>   start on a given piece
//   ?follow=0                  don't follow selection changes made elsewhere
//   ?ui=0                      never show the corner menu
//   ?mode=ambient|interactive  force a mode (see lib/interaction.js)

import './styles.css';
import { entries, findEntry, normalizeSelection, DEFAULT_SELECTION, DAILY_MINIMAL } from './shell/registry.js';
import { createP5Host, createDomHost } from './shell/host.js';
import { initSync, getShared, setShared, subscribe } from './shell/sync.js';

const params = new URLSearchParams(location.search);
const follow = params.get('follow') !== '0';
const showUi = params.get('ui') !== '0';

const stages = document.getElementById('stages');
const ui = document.getElementById('ui');
const pick = document.getElementById('pick');
const gridBtn = document.getElementById('grid-btn');
const cycleBox = document.getElementById('cycle');
const cycleMin = document.getElementById('cycle-min');
const grid = document.getElementById('dm-grid');

const dmEntry = findEntry(DAILY_MINIMAL);

// ---- hosts (created lazily per selection key, never destroyed) ----------

const hosts = new Map();

function hostKey(sel) {
  return sel.id === DAILY_MINIMAL ? `dm:${sel.sub}` : sel.id;
}

function getHost(sel) {
  const key = hostKey(sel);
  if (!hosts.has(key)) {
    const entry = findEntry(sel.id);
    let host;
    if (entry.group) {
      const dm = entry.group.find((d) => d.id === sel.sub);
      host = createP5Host({ id: key, sketch: dm.sketch }, stages);
    } else if (entry.mount) {
      host = createDomHost({ id: key, mount: entry.mount }, stages);
    } else {
      host = createP5Host({ id: key, sketch: entry.sketch }, stages);
    }
    hosts.set(key, host);
  }
  return hosts.get(key);
}

// Instantiate every sketch up front (setup itself is deferred; see host.js).
for (const entry of entries) {
  if (entry.group) for (const dm of entry.group) getHost({ id: entry.id, sub: dm.id });
  else getHost({ id: entry.id });
}

// ---- selection ------------------------------------------------------------

let current = null;

function show(rawSel, { share = true } = {}) {
  const sel = normalizeSelection(rawSel);
  if (current && hostKey(current) === hostKey(sel)) return;
  if (current) getHost(current).deactivate();
  current = sel;
  getHost(sel).activate();
  pick.value = sel.id;
  gridBtn.hidden = sel.id !== DAILY_MINIMAL;
  markGridSelection();
  document.title = labelFor(sel);
  if (share) setShared('selection', { ...sel, t: Date.now() });
}

function labelFor(sel) {
  const entry = findEntry(sel.id);
  if (entry.group) return `${entry.group.find((d) => d.id === sel.sub).label} · Daily Minimal`;
  return entry.label;
}

// ---- dropdown --------------------------------------------------------------

for (const entry of entries) {
  const opt = document.createElement('option');
  opt.value = entry.id;
  opt.textContent = entry.label;
  pick.append(opt);
}

pick.addEventListener('change', () => {
  const id = pick.value;
  if (id === DAILY_MINIMAL) {
    const last = getShared('lastDailyMinimal');
    show({ id, sub: last || DEFAULT_SELECTION.sub });
    openGrid();
  } else {
    show({ id });
  }
  pick.blur();
});

// ---- Daily Minimal grid ----------------------------------------------------

for (const dm of dmEntry.group) {
  const btn = document.createElement('button');
  btn.className = 'thumb';
  btn.dataset.sub = dm.id;
  btn.innerHTML = `<img alt="" loading="lazy" src="thumbs/${dm.id}.png"><span>${dm.label}</span>`;
  btn.querySelector('img').addEventListener('error', (e) => e.target.remove(), { once: true });
  btn.addEventListener('click', () => {
    show({ id: DAILY_MINIMAL, sub: dm.id });
    setShared('lastDailyMinimal', dm.id);
    closeGrid();
  });
  grid.querySelector('.grid').append(btn);
}

function markGridSelection() {
  for (const b of grid.querySelectorAll('.thumb')) {
    b.classList.toggle('current', current?.id === DAILY_MINIMAL && b.dataset.sub === current.sub);
  }
}

function openGrid() {
  grid.hidden = false;
  markGridSelection();
}
function closeGrid() {
  grid.hidden = true;
}

gridBtn.addEventListener('click', () => (grid.hidden ? openGrid() : closeGrid()));
grid.addEventListener('click', (e) => {
  if (e.target === grid) closeGrid();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !grid.hidden) closeGrid();
});

// ---- auto-cycle -------------------------------------------------------------

const CYCLE_DEFAULT = { on: false, minutes: 15 };

function cycleSettings() {
  return { ...CYCLE_DEFAULT, ...(getShared('autoCycle') || {}) };
}

function renderCycle() {
  const s = cycleSettings();
  cycleBox.checked = s.on;
  cycleMin.value = String(s.minutes);
  cycleMin.disabled = !s.on;
}

for (const m of [5, 10, 15, 30, 60, 120]) {
  const opt = document.createElement('option');
  opt.value = String(m);
  opt.textContent = m < 60 ? `${m} min` : `${m / 60} h`;
  cycleMin.append(opt);
}

cycleBox.addEventListener('change', () => {
  setShared('autoCycle', { ...cycleSettings(), on: cycleBox.checked });
  // restart the interval from now
  setShared('selection', { ...current, t: Date.now() });
  renderCycle();
});
cycleMin.addEventListener('change', () => {
  setShared('autoCycle', { ...cycleSettings(), minutes: Number(cycleMin.value) });
  renderCycle();
});

function randomOther(list, notThis) {
  const pool = list.filter((x) => x !== notThis);
  return pool[Math.floor(Math.random() * pool.length)];
}

function cycleTick() {
  const s = cycleSettings();
  if (!s.on || document.hidden || !current) return;
  const since = Date.now() - (getShared('selection')?.t || 0);
  if (since < s.minutes * 60_000) return;
  const next = randomOther(entries, findEntry(current.id));
  if (next.group) show({ id: next.id, sub: next.group[Math.floor(Math.random() * next.group.length)].id });
  else show({ id: next.id });
}

// ---- corner menu visibility ---------------------------------------------

let idleTimer;
function wakeUi() {
  if (!showUi) return;
  ui.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!ui.matches(':hover') && !ui.contains(document.activeElement)) ui.classList.add('idle');
    else wakeUi();
  }, 4000);
}
ui.hidden = !showUi;
ui.classList.add('idle');
window.addEventListener('pointermove', wakeUi, { passive: true });
window.addEventListener('pointerdown', wakeUi, { passive: true });

// ---- boot -------------------------------------------------------------------

await initSync({ follow });

const fromUrl = params.get('sketch') ? { id: params.get('sketch'), sub: params.get('sub') } : null;
show(fromUrl || getShared('selection') || DEFAULT_SELECTION, { share: false });
renderCycle();

subscribe('selection', (sel) => show(sel, { share: false }));
subscribe('autoCycle', renderCycle);
setInterval(cycleTick, 15_000);

// Debug/automation hook (used by scripts/check.mjs and scripts/thumbs.mjs).
window.__wallpaper = {
  show: (sel) => show(sel),
  current: () => current,
  frameCounts: () => Object.fromEntries([...hosts].map(([k, h]) => [k, h.instance?.frameCount ?? null])),
  keys: () => [...hosts.keys()],
};

// WebKit (Plash) plays the macOS alert sound for key presses nothing
// "handles". Mark plain key presses outside form fields as handled so the
// pieces' keyboard controls never beep. Cmd/Ctrl/Alt shortcuts pass through.
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const el = document.activeElement;
  if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName))) return;
  e.preventDefault();
});
