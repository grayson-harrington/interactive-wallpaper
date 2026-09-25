# Contributing

How to work on the interactive wallpaper, and the conventions every piece follows.
See [README.md](README.md) for what the app is and how to run it day to day.

## Setup

```sh
npm install
npx playwright install chromium webkit   # only needed for `npm run check` / `npm run thumbs`
```

- `npm run dev` runs Vite with hot reload at http://localhost:5173, plus the API server.
  The launchd agent already holds port 4747, so stop it first
  (`npm run uninstall-agent`) or run the dev pair on another port (`PORT=4848 npm run dev`).
- Plash only ever sees `dist/`. After changing anything, run `npm run build` and reload Plash.
  The server doesn't need a restart unless you changed `server/server.mjs`
  (`launchctl kickstart -k gui/$(id -u)/com.graysonharrington.interactive-wallpaper`).

## Adding a piece

1. Create `src/sketches/<name>.js` that exports a p5 **instance-mode** sketch:

   ```js
   export default function mySketch(p) {
     p.setup = () => {
       p.createCanvas(p.windowWidth, p.windowHeight);
       p.frameRate(30);
     };
     p.draw = () => { /* ... */ };
     p.windowResized = () => {
       p.resizeCanvas(p.windowWidth, p.windowHeight);
       // recompute anything that depends on the screen size
     };
   }
   ```

2. Register it in `src/shell/registry.js`. The order of `entries` is the order in the dropdown.
3. Run `npm run build`, then `npm run check` with the server running.

For a new **Daily Minimal**, build it with `dmSketch()` from `src/sketches/daily-minimal/harness.js`.
The harness lets you draw in the original canvas coordinates and handles fitting that canvas to the screen.
Add the piece to `daily-minimal/index.js`, then run `npm run thumbs` to generate its grid thumbnail.

For a plain-DOM piece (no canvas), use `{ id, label, mount }` in the registry, as the photo slideshow does in `photos.js`.

## The lifecycle contract (`src/shell/host.js`)

Only one piece runs at a time. The host calls `noLoop()` on hidden pieces and sets them
to `display: none`. Instances are never destroyed, so state persists across switches.
A piece's `setup()` runs the first time it's shown, not at page load.

- **Static pieces** (render once, then idle) call `p.noLoop()` at the **end of `draw()`**, never in `setup()`.
  The host calls `loop()` right after `setup()`, which would override a `noLoop()` made there.
- **Timers** go through `p.schedule(fn, ms)`, never raw `setTimeout`/`setInterval`.
  The host cancels scheduled calls when the piece is hidden, so nothing runs in the background.
  If a piece was holding before a reseed, re-arm the hold in `p.onActivate`.
- **Repaint on show:** browsers may throw away a hidden canvas's pixels.
  Pieces that draw once and stop must redraw (or `putImageData` a cached result) in `p.onActivate`.
- **Input handlers** (`mousePressed`, `keyPressed`, ...) only fire for the active piece and only for
  events on its own canvas. Clicks on menus and panels never reach the sketch.
- Use `p.pixelDensity(1)` for pixel-buffer work (grids, ImageData, simulations).
  Leave the default density for line art.

## Ambient vs interactive

Plash may not forward mouse or keyboard input, so every interactive piece needs a mode
that runs without any input:

- `p.interactive()` is true only while real input has arrived recently (default: the last 60 s).
  Use it to switch between the ambient/attract behavior and full controls. Don't add a manual toggle.
- Ambient mode should look intentional. For example, a scripted "player" or a wandering stand-in
  for the mouse (`wanderer()` in the DM harness).
- Test both: `?mode=ambient` and `?mode=interactive` force either one.

## Controls and UI

- Use the helpers in `src/lib/panel.js`:
  - `createPanel` for settings.
  - `createHud` for a one-line key bar.
  - `autoFade([...elements])` so they disappear when no one is using the page.
- Put per-piece panels in the bottom-right corner (`corner-br` class), like Game of Life,
  Flow Field and Flow Pipes. The top-right corner is the shell's menu.
- Remember per-browser settings in `localStorage` under an `iw:<piece>:` key, inside `try/catch`.
  Settings that should follow the user from a browser tab into Plash go through
  `getShared`/`setShared` in `src/shell/sync.js` instead (see the L-System piece).
- No save/export features and no audio.
- Key handlers must not rely on the browser's default key behavior. The shell already marks plain key
  presses as handled so WebKit doesn't play the system alert sound.

## Energy budget

This runs all day as a desktop background, so keep it cheap:

- Cap frame rates. 30 fps is plenty for most things; use 5–15 for grids and clocks. If a
  simulation needs its original speed, take several simulation steps per drawn frame.
- Stop computing when nothing changes: detect a settled or stagnant state, `noLoop()`, hold, then reseed.
- Keep hot loops allocation-free (typed arrays, inline math). Batch canvas strokes into one path when possible.
- Anything that accumulates (trails, particle histories, drawn marks) needs a cap or a reset.

## Images

- `images/wallpapers/` and `images/voronoi/` are read live by the server, with no rebuild needed.
  Their contents are personal and gitignored; don't commit images there.
- Anything under `public/` is bundled at build time. Only use it for fixed assets (fonts, thumbnails).

## Testing

```sh
npm run serve                                   # or rely on the launchd agent
npm run check                                   # Chromium: every piece, errors + lifecycle + screenshots
BROWSER=webkit DPR=2 npm run check              # WebKit is Plash's engine; test here before shipping
ONLY=flow-pipes WAIT=10000 npm run check        # one piece, longer settle time
```

`check` fails if a piece logs an error or if a hidden piece keeps drawing.
Screenshots land in `check-out/` (or the directory you pass).
Look at them, because a piece can pass with a blank or misplaced canvas.

## Server and launchd

- `server/server.mjs` has no dependencies on purpose, so launchd only needs `node`.
- macOS privacy rules apply because the project lives in `~/Documents`.
  After reinstalling the agent (`npm run install-agent`), approve the "node would like to access
  your Documents folder" prompt, or the server never starts listening.
- Server logs: `~/Library/Logs/interactive-wallpaper.log`.
