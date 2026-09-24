// Phase 0: does Plash forward mouse moves, clicks and keystrokes to the page?
// Counts each kind of event and reports the totals to the server so the
// answer can be read back later (curl localhost:4747/api/state).
import p5 from 'p5';

const counts = { move: 0, click: 0, key: 0 };
const ua = navigator.userAgent;

function mark(kind) {
  counts[kind]++;
  const el = document.getElementById(kind);
  el.textContent = `${counts[kind]} event${counts[kind] === 1 ? '' : 's'}`;
  el.className = 'yes';
}

window.addEventListener('pointermove', (e) => e.isTrusted && mark('move'));
window.addEventListener('pointerdown', (e) => e.isTrusted && mark('click'));
document.getElementById('text').addEventListener('keydown', (e) => e.isTrusted && mark('key'));

let reported = '';
setInterval(() => {
  const body = JSON.stringify({ inputTest: { ...counts, ua, at: new Date().toISOString() } });
  if (body === reported) return;
  reported = body;
  fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
}, 2000);

new p5((p) => {
  let hue = 160;
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    p.colorMode(p.HSB);
  };
  p.draw = () => {
    p.background(0, 0, 7);
    p.noStroke();
    p.fill(hue, 60, 95);
    p.circle(p.mouseX, p.mouseY, 60);
  };
  p.mousePressed = () => {
    hue = (hue + 67) % 360;
  };
  p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
});
