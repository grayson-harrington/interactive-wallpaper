# Interactive Wallpaper

A growing collection of animated, interactive p5.js pieces, served locally so
[Plash](https://sindresorhus.com/plash) can show them as a live macOS desktop background.
Some are ports of my older Processing and Python projects and some are new work, and
the collection keeps changing. A menu in the corner picks which piece is showing, and
only that piece runs.

The biggest part of it is **Daily Minimal**: animated, interactive versions of Pierre
Voisin's Daily Minimal designs. It's actively being added to, and it will keep growing.

## The pieces

The menu lists the two main pieces first, then a faint divider, then everything else.

| Main pieces | What it is |
|---|---|
| Traditional Wallpaper | Hourly crossfading slideshow of your photos; click for the next one |
| Daily Minimal | Animated ports of Daily Minimal designs, chosen from a thumbnail grid (see below) |

| Other pieces | What it is |
|---|---|
| Fractal Tree | Recursive tree that sways; follows the mouse when you move it |
| Voronoi Images | Photos rebuilt from Voronoi cells. Click: next image · right-click: pick a file · adjustable cell count |
| Procedural Terrain | A sea of generated islands with biome coloring, rising tile by tile |
| Tree Patterns | A branching tree grown by colored-node rules, with an adjuster panel and color legend |
| Bicycle Galaxy | A stationary bike whose rotating parts leave trails, as if it were riding forward |
| Game of Life | Self-reseeding soup; click or type to use the full editor (paint, copy/paste, colors) |
| Flow Pipes | Rotate-the-pipes puzzle with flowing water; solves itself in ambient mode |
| Quad Tree | A quadtree subdividing live, with a range query following the mouse or a slow path |
| Flocking | Boids (separation, alignment, cohesion); click to add a boid |
| Flow Field | Thousands of hairline strokes following Perlin noise, with a rolling erase |
| Spinodal Decomposition | Phase-separation simulation that settles, holds, and reseeds |
| L-System Tool | L-system editor with presets, rules, angle, iterations, colors |
| Nested Orbits | A ball inside a sphere, both covered in nested circles orbiting inside each other; drag to roll it |

## Daily Minimal

[Daily Minimal](https://dailyminimal.com) was Pierre Voisin's project of a new geometric
design every day. Each port here takes one of those static designs and animates it:
it starts on the original image, moves on its own (a slow orbit, rolling phases, links
that melt and re-form), and answers the mouse when you use the page. The original design
is always the rest pose the animation comes back to.

- **Picking one:** choose Daily Minimal in the menu, then a design from the thumbnail
  grid (▦). The grid has its own auto-cycle that moves between designs.
- **What's there:** [ported.csv](src/sketches/daily-minimal/ported.csv) lists every port
  with its design ID, title and date. New ones are added regularly.
- **Credit:** each design is shown with its ID and "Daily Minimal by Pierre Voisin" in the
  bottom-left corner. The ports are an unofficial, non-commercial tribute; see the
  [Daily Minimal README](src/sketches/daily-minimal/README.md) for attribution, the source
  archive and how ports are made.

## First-time setup

Requires macOS, [Node.js](https://nodejs.org) 20+, and Plash.

```sh
npm install
npm run build
npm run install-agent      # launchd agent: starts the server at login, restarts it if it crashes
```

1. If the project lives under `~/Documents` (or Desktop/Downloads), macOS will ask whether
   **node** may access that folder. Allow it; until you do, the server can't start.
   Check it's up with `curl localhost:4747/api/health`.
2. Put images in `images/static_wallpapers/` and `images/voronoi/` (see below).
3. In Plash, add the website `http://localhost:4747`.
4. Turn Plash's **Browsing Mode** off for everyday use. With it on, the wallpaper only
   shows on one Space and the others show your normal wallpaper.

Server log: `~/Library/Logs/interactive-wallpaper.log`.

## Choosing what shows

- **Corner menu** (top right, fades out when idle): the piece dropdown (Traditional
  Wallpaper and Daily Minimal first), the Daily Minimal grid (▦), and auto-cycle, which switches to a random piece every 5 min – 2 h.
- **Daily Minimal auto-cycle** (in the ▦ grid): while a Daily Minimal is showing, switches
  to a random other one on its own interval. It works with global auto-cycle on or off.
  With both on, the global cycle still moves on to another piece once its interval has
  passed since it arrived at Daily Minimal.
- **From a browser tab:** Plash usually doesn't pass clicks through to the page. Open
  `http://localhost:4747` in a normal browser and pick a piece there. The selection is shared
  through the server, so Plash follows within a few seconds. The same goes for L-System settings.
- **URL options:** `?sketch=<id>&sub=<dm id>` starts on a piece, `?follow=0` ignores changes
  made elsewhere, `?ui=0` hides the menu, and `?mode=ambient|interactive` forces a mode.

## Ambient vs interactive

Interactive pieces choose their mode on their own. They run an ambient or attract mode (self-playing
games, a wandering stand-in for the mouse) until real input arrives, switch to full
controls, and fall back after 15 seconds of inactivity. So the desktop gets the ambient
version and a browser tab gets the interactive one, from the same page.

## Images (your own, picked up live, not in git)

| Folder | Used by |
|---|---|
| `images/static_wallpapers/` | **Traditional Wallpaper** photos |
| `images/voronoi/` | **Voronoi Images** source pictures (right-click the piece to use any file instead) |

Drop JPEG/PNG/GIF/WebP/HEIC files in; they join the rotation on the next switch, with no rebuild.
The folders are tracked (via `.gitkeep`) but their contents are gitignored, so a fresh clone
starts empty. To keep images elsewhere, set `WALLPAPER_DIR` / `VORONOI_DIR` in the launchd plist.

## Commands

| command | what it does |
|---|---|
| `npm run build` | build `dist/`. Plash picks up changes on reload; no server restart needed |
| `npm run dev` | Vite dev server (http://localhost:5173) + API server. Stop the agent first, or set `PORT` |
| `npm run serve` | run the production server by hand |
| `npm run check` | headless smoke test of every piece (errors, lifecycle, screenshots); `BROWSER=webkit` tests Plash's engine |
| `npm run thumbs` | regenerate the Daily Minimal thumbnails (server must be running; `ONLY=<id>,...` for some) |
| `npm run install-agent` / `uninstall-agent` | manage the launchd agent |

## Layout

- `server/server.mjs`: a dependency-free Node server. It serves `dist/` and the live image folders
  (`images/static_wallpapers` and `images/voronoi` via `/api/wallpapers` and `/api/voronoi-images`, re-read on every request),
  and `/api/state` holds the shared state.
- `src/shell/`: the host lifecycle, the registry of pieces, and state sync. Every sketch is
  instantiated up front, only the active one loops, and hidden ones are `display: none`.
- `src/sketches/`: one module per piece. `daily-minimal/` holds the Daily Minimal ports and their harness.
- `src/lib/`: shared helpers (input tracking, control panels, paper textures).

Adding or changing a piece: see [CONTRIBUTING.md](CONTRIBUTING.md).
