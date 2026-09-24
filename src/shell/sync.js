// Small client for the server's shared key/value state (/api/state).
//
// Plash and a normal browser tab don't share localStorage, so anything that
// should carry across (which piece is showing, auto-cycle, L-system settings)
// goes through the server. The page polls for changes; if the server isn't
// reachable (e.g. a plain static host) it falls back to localStorage alone.

const POLL_MS = 4000;
const LS_PREFIX = 'iw:';

let rev = -1;
let values = {};
let online = false;
let enabled = true;
const subscribers = new Map();

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage unavailable (private window etc.) - nothing to do
  }
}

async function poll() {
  if (!enabled) return;
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    const next = await res.json();
    online = true;
    if (next.rev === rev) return;
    rev = next.rev;
    const prev = values;
    values = next.values || {};
    for (const [key, fns] of subscribers) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(values[key]) && values[key] !== undefined) {
        lsSet(key, values[key]);
        for (const fn of fns) fn(values[key]);
      }
    }
  } catch {
    online = false;
  }
}

export async function initSync({ follow = true } = {}) {
  enabled = follow;
  if (!follow) return;
  await poll();
  setInterval(() => {
    if (!document.hidden) poll();
  }, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) poll();
  });
}

export function getShared(key) {
  return (enabled && values[key] !== undefined ? values[key] : undefined) ?? lsGet(key);
}

export async function setShared(key, value) {
  values = { ...values, [key]: value };
  lsSet(key, value);
  if (!enabled) return;
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (res.ok) {
      const next = await res.json();
      rev = next.rev;
      values = next.values || values;
      online = true;
    }
  } catch {
    online = false;
  }
}

// fn(value) runs when another page changes `key`.
export function subscribe(key, fn) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key).add(fn);
  return () => subscribers.get(key).delete(fn);
}

export function isOnline() {
  return online;
}
