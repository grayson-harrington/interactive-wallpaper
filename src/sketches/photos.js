// Traditional Wallpaper: an hourly photo slideshow of images/wallpapers/.
//
// Plain DOM, no canvas: two stacked full-screen <img> layers crossfade over
// ~2.5s. The file list comes from the server's live /api/wallpapers route and
// is re-fetched before every switch, so photos dropped into (or removed from)
// the folder join (or leave) the rotation on the next cycle with no rebuild.
// Order is a shuffled queue: every photo is shown once per pass, then the
// pool is reshuffled (never repeating the photo currently on screen).
// Click for the next photo. The timer only runs while this entry is showing;
// coming back restarts the hour with a fresh photo.

const INTERVAL_MS = 60 * 60 * 1000;
const FADE_MS = 2500;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function mountPhotos(el) {
  el.classList.add('photos');
  const layers = [document.createElement('img'), document.createElement('img')];
  for (const img of layers) {
    img.alt = '';
    img.decoding = 'async';
    el.append(img);
  }
  const message = document.createElement('div');
  message.className = 'photos-message';
  message.hidden = true;
  el.append(message);

  let front = 0;
  let current = null;
  let queue = [];
  const shown = new Set();
  let timer = null;
  let active = false;
  let busy = false;

  async function fetchFiles() {
    const res = await fetch('/api/wallpapers', { cache: 'no-store' });
    if (!res.ok) throw new Error(`server said ${res.status}`);
    return (await res.json()).files;
  }

  function pickNext(files) {
    const available = new Set(files);
    // drop photos that were removed from the folder
    queue = queue.filter((f) => available.has(f));
    for (const f of [...shown]) if (!available.has(f)) shown.delete(f);
    // newly added photos join this pass at random positions
    for (const f of files) {
      if (!queue.includes(f) && !shown.has(f) && f !== current) {
        queue.splice(Math.floor(Math.random() * (queue.length + 1)), 0, f);
      }
    }
    if (queue.length === 0) {
      shown.clear();
      queue = shuffle(files.filter((f) => f !== current));
      if (queue.length === 0 && files.length) queue = [files[0]];
    }
    const next = queue.shift();
    if (next) shown.add(next);
    return next;
  }

  async function advance() {
    if (busy) return;
    busy = true;
    try {
      const files = await fetchFiles();
      if (!files.length) {
        message.textContent = 'No photos found in the wallpaper folder.';
        message.hidden = false;
        return;
      }
      const next = pickNext(files);
      if (!next || !active) return;
      const incoming = layers[1 - front];
      const outgoing = layers[front];
      incoming.style.transition = 'none';
      incoming.style.opacity = '0';
      incoming.src = `/wallpapers/${encodeURIComponent(next)}`;
      await incoming.decode().catch(() => {});
      if (!active) return;
      message.hidden = true;
      incoming.style.zIndex = '2';
      outgoing.style.zIndex = '1';
      void incoming.offsetWidth; // commit opacity 0 before transitioning
      incoming.style.transition = `opacity ${FADE_MS}ms ease`;
      incoming.style.opacity = '1';
      setTimeout(() => {
        // skip if a newer switch has already reused this layer
        if (layers[front] === incoming) {
          outgoing.style.transition = 'none';
          outgoing.style.opacity = '0';
        }
      }, FADE_MS + 100);
      front = 1 - front;
      current = next;
    } catch (err) {
      message.textContent = `Photo server not reachable (${err.message}). Run the app with \`npm run serve\` or \`npm run dev\`.`;
      message.hidden = false;
    } finally {
      busy = false;
    }
  }

  // click for the next photo (and restart the hour from now)
  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(advance, INTERVAL_MS);
  }
  el.addEventListener('click', () => {
    if (!active) return;
    advance();
    restartTimer();
  });

  return {
    activate() {
      active = true;
      advance();
      restartTimer();
    },
    deactivate() {
      active = false;
      clearInterval(timer);
      timer = null;
    },
  };
}
