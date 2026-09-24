// Lifecycle wrapper around one p5 instance-mode sketch.
//
// Every sketch gets its own p5 instance up front, but only the active one runs
// its draw loop. Deactivating calls noLoop() and hides the container (so the
// browser neither runs draw() nor composites the canvas). Instances are never
// destroyed, so state survives switching away and back.
//
// Deviation from "run every setup() at load": a sketch's own setup() is
// deferred until the first time it is shown. With ~30 full-screen canvases at
// retina density, allocating them all up front would cost hundreds of MB for
// pieces that may never be looked at. After first activation everything
// behaves exactly as planned: state is resident and persists.
//
// Sketch contract (see src/sketches/*):
//   export default function sketch(p) {
//     p.setup / p.draw / p.windowResized / input handlers as usual
//     p.onActivate?.()    optional, called every time the sketch is shown
//     p.onDeactivate?.()  optional, called every time it is hidden
//   }
// Helpers added to p by the host:
//   p.schedule(fn, ms)  setTimeout that is cancelled when the sketch is hidden
//   p.interactive()     true while a person is actively using the page
//   p.isActive()

import p5 from 'p5';
import { isInteractive } from '../lib/interaction.js';

const MOUSE_HANDLERS = [
  'mousePressed',
  'mouseReleased',
  'mouseClicked',
  'mouseMoved',
  'mouseDragged',
  'doubleClicked',
  'mouseWheel',
  'touchStarted',
  'touchMoved',
  'touchEnded',
];
const KEY_HANDLERS = ['keyPressed', 'keyReleased', 'keyTyped'];

function typingInFormField() {
  const el = document.activeElement;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function createP5Host({ id, sketch }, parent) {
  const el = document.createElement('div');
  el.className = 'stage';
  el.dataset.sketch = id;
  el.hidden = true;
  parent.append(el);

  let active = false;
  let started = false;
  let resizePending = false;
  const timers = new Set();
  let user = {};
  let p;

  // Static sketches must call noLoop() at the end of draw(), not in setup():
  // the loop() here (which p5 runs synchronously once its own setup is done)
  // would override it.
  const start = () => {
    started = true;
    user.setup?.();
    p.loop();
  };

  new p5((inst) => {
    p = inst;
    p.schedule = (fn, ms) => {
      const t = setTimeout(() => {
        timers.delete(t);
        if (active) fn();
      }, ms);
      timers.add(t);
      return t;
    };
    p.cancelScheduled = () => {
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
    p.interactive = (idleMs) => isInteractive(idleMs);
    p.isActive = () => active;

    sketch(p);
    user = {
      setup: p.setup,
      draw: p.draw,
      windowResized: p.windowResized,
    };

    p.setup = () => {
      p.noLoop();
      if (active) start();
    };
    p.draw = () => {
      if (active && started) user.draw?.();
    };
    p.windowResized = () => {
      if (active && started) user.windowResized?.();
      else if (started) resizePending = true;
    };

    for (const name of MOUSE_HANDLERS) {
      const fn = p[name];
      if (typeof fn !== 'function') continue;
      p[name] = (e) => {
        if (!active || !started) return;
        // p5 listens on window; only react to events aimed at this canvas,
        // not the shell's menus or a sketch's own DOM control panel.
        if (e && e.target && e.target !== p.canvas) return;
        return fn(e);
      };
    }
    for (const name of KEY_HANDLERS) {
      const fn = p[name];
      if (typeof fn !== 'function') continue;
      p[name] = (e) => {
        if (!active || !started || typingInFormField()) return;
        return fn(e);
      };
    }
  }, el);

  return {
    id,
    el,
    get instance() {
      return p;
    },
    activate() {
      if (active) return;
      active = true;
      el.hidden = false;
      if (!started) {
        // p5 finishes its own construction on window load; if that hasn't
        // happened yet, its setup wrapper will call start().
        if (p._setupDone) start();
        return;
      }
      if (resizePending) {
        resizePending = false;
        user.windowResized?.();
      }
      p.onActivate?.();
      p.loop();
    },
    deactivate() {
      if (!active) return;
      active = false;
      p.noLoop();
      p.cancelScheduled();
      el.hidden = true;
      if (started) p.onDeactivate?.();
    },
  };
}

// Same interface for pieces that are plain DOM (Traditional Wallpaper).
export function createDomHost({ id, mount }, parent) {
  const el = document.createElement('div');
  el.className = 'stage';
  el.dataset.sketch = id;
  el.hidden = true;
  parent.append(el);
  let controller = null;
  let active = false;
  return {
    id,
    el,
    activate() {
      if (active) return;
      active = true;
      el.hidden = false;
      controller ??= mount(el);
      controller.activate?.();
    },
    deactivate() {
      if (!active) return;
      active = false;
      el.hidden = true;
      controller?.deactivate?.();
    },
  };
}
