// Tracks whether a real person is currently interacting with the page.
//
// Every interactive piece has two modes: an ambient/attract mode that needs no
// input (what Plash shows if it doesn't forward events) and a full interactive
// mode. Rather than configuring which one to use, sketches ask
// `isInteractive()`: it is true only while genuine (isTrusted) input has
// arrived recently, so the same page does the right thing in Plash and in a
// normal browser tab.
//
// Override with ?mode=ambient or ?mode=interactive in the URL.

const params = new URLSearchParams(location.search);
const forced = params.get('mode');

let lastInput = -Infinity;
const listeners = new Set();

function mark(e) {
  if (!e.isTrusted) return;
  lastInput = performance.now();
  for (const fn of listeners) fn(e);
}

for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
  window.addEventListener(type, mark, { capture: true, passive: true });
}

export const DEFAULT_IDLE_MS = 60_000;

export function isInteractive(idleMs = DEFAULT_IDLE_MS) {
  if (forced === 'ambient') return false;
  if (forced === 'interactive') return true;
  return performance.now() - lastInput < idleMs;
}

export function msSinceInput() {
  return performance.now() - lastInput;
}

export function onInput(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
