// Tiny DOM control-panel / HUD builder for the interactive pieces.
// Panels fade away when nobody is using the page, so an ambient wallpaper
// never shows controls.

import { isInteractive, onInput } from './interaction.js';

export function autoFade(elements, idleMs = 8000) {
  const els = elements.filter(Boolean);
  let timer;
  let pinned = false;
  const busy = () => pinned || els.some((el) => el.matches(':hover') || el.contains(document.activeElement));
  const fadeLater = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (busy()) fadeLater();
      else for (const el of els) el.classList.add('faded');
    }, idleMs);
  };
  const wake = () => {
    for (const el of els) el.classList.remove('faded');
    fadeLater();
  };
  if (isInteractive(idleMs)) wake();
  else for (const el of els) el.classList.add('faded');
  onInput(wake);
  return {
    wake,
    pin(v) {
      pinned = v;
      if (v) wake();
    },
  };
}

export function createHud(parent) {
  const el = document.createElement('div');
  el.className = 'sk-hud';
  el.hidden = true;
  parent.append(el);
  return {
    el,
    set(text) {
      el.hidden = !text;
      if (el.textContent !== text) el.textContent = text;
    },
  };
}

export function createPanel(parent, { title, toggleLabel = 'Controls', open = false } = {}) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sk-toggle';
  toggle.textContent = toggleLabel;

  const el = document.createElement('div');
  el.className = 'sk-panel';
  el.hidden = !open;
  toggle.hidden = open;
  if (title) {
    const h = document.createElement('h3');
    h.textContent = title;
    el.append(h);
  }
  parent.append(toggle, el);

  const panel = {
    el,
    toggle,
    get open() {
      return !el.hidden;
    },
    show() {
      el.hidden = false;
      toggle.hidden = true;
    },
    hide() {
      el.hidden = true;
      toggle.hidden = false;
    },
    flip() {
      if (el.hidden) panel.show();
      else panel.hide();
    },
    row(label, control, valueText) {
      const row = document.createElement('label');
      row.className = 'row';
      const head = document.createElement('span');
      const name = document.createElement('b');
      name.style.fontWeight = '500';
      name.textContent = label;
      const val = document.createElement('i');
      val.style.fontStyle = 'normal';
      val.textContent = valueText ?? '';
      head.append(name, val);
      row.append(head, control);
      el.append(row);
      return { row, val };
    },
    range(label, { min, max, step = 1, value, format = (v) => String(v) }, onChange) {
      const input = document.createElement('input');
      input.type = 'range';
      Object.assign(input, { min, max, step });
      input.value = value;
      const { val } = panel.row(label, input, format(Number(value)));
      input.addEventListener('input', () => {
        val.textContent = format(Number(input.value));
        onChange(Number(input.value));
      });
      return {
        input,
        set(v) {
          input.value = v;
          val.textContent = format(Number(v));
        },
      };
    },
    text(label, value, onChange, { multiline = false } = {}) {
      const input = document.createElement(multiline ? 'textarea' : 'input');
      if (!multiline) input.type = 'text';
      input.spellcheck = false;
      input.value = value;
      panel.row(label, input);
      input.addEventListener('input', () => onChange(input.value));
      return input;
    },
    select(label, options, value, onChange) {
      const input = document.createElement('select');
      for (const o of options) {
        const opt = document.createElement('option');
        opt.value = o.value;
        opt.textContent = o.label;
        input.append(opt);
      }
      input.value = value;
      panel.row(label, input);
      input.addEventListener('change', () => onChange(input.value));
      return input;
    },
    checkbox(label, value, onChange) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = value;
      const { row } = panel.row(label, input);
      row.classList.add('check');
      input.addEventListener('change', () => onChange(input.checked));
      return input;
    },
    color(label, value, onChange) {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = value;
      input.style.width = '100%';
      input.style.height = '26px';
      input.style.background = 'none';
      input.style.border = '0';
      panel.row(label, input);
      input.addEventListener('input', () => onChange(input.value));
      return input;
    },
    buttons(defs) {
      const wrap = document.createElement('div');
      wrap.className = 'buttons';
      for (const [text, fn] of defs) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = text;
        b.addEventListener('click', fn);
        wrap.append(b);
      }
      el.append(wrap);
      return wrap;
    },
    note(text) {
      const p = document.createElement('p');
      p.className = 'note';
      p.textContent = text;
      el.append(p);
      return p;
    },
  };

  toggle.addEventListener('click', () => panel.show());
  return panel;
}
