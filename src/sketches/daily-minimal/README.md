# Daily Minimal

Animated, interactive p5.js versions of static designs from **Daily Minimal**.

## Attribution

All designs in this folder are reinterpretations of original work by
**Pierre Voisin**, the graphic designer behind **Daily Minimal**: [dailyminimal.com](https://dailyminimal.com),
[@daily_minimal](https://www.instagram.com/daily_minimal/),
[pinterest.com/dailyminimal](https://www.pinterest.com/dailyminimal/).
Daily Minimal published a new geometric design every day. The composition,
palette and idea of each piece belong to Pierre Voisin. The code here only adds motion
and interaction. Credit Pierre Voisin / Daily Minimal wherever these pieces
are shown or shared.

Some designs were also animated by others, as their captions note. Those
animations don't need attribution here: the ports animate the static designs
from scratch.

**These ports are an unofficial, non-commercial personal tribute.** They are
not affiliated with or endorsed by Pierre Voisin or Daily Minimal. The original
designs and all rights in them belong to Pierre Voisin. If you are the rights
holder and would like any of these ports changed or removed, please open an
issue or contact the repo owner, and they will be taken down promptly.

The source images are not committed to this repo and should not be
redistributed.

## Source images

The static originals live in a local archive outside this repo and are never
committed. Each design is identified by its Daily Minimal ID:

| Prefix        | Series                                                  |
| ------------- | ------------------------------------------------------- |
| `S01-NNN`     | Série 1                                                  |
| `S02-NNN`     | Série 2 (`S02-A01`–`A04` are extra/alternate pieces)     |
| `IF-NNN`      | Impossible Figures design week                          |
| `DW-BH-NNN`   | Bauhaus Design Week                                     |
| `DW-IS-NNN`   | Islamic Design Week                                     |
| `DW-JP-NNN`   | Japanese Design Week                                    |
| `DW-SP-NNN`   | Space Design Week                                       |
| `SE-BS-NNN`   | Special Edition: Basic Shapes                           |
| `SE-COL-NNN`  | Special Edition: color series                           |
| `SE-OI-NNN`   | Special Edition: Optical Illusions                      |
| `C-`, `S-`, `T-`, `A-` | The lettered collections                       |

## Where ports live in this app

- Each port is one file in this folder, built with `dmSketch()` from
  [harness.js](harness.js). The harness lets a piece draw in the original canvas
  coordinates. Every piece declares `art: [x, y, w, h]`, the rest-pose bounds of
  its main form. The harness scales that box so its equal-area side, `sqrt(w·h)`,
  is 50% of the shorter screen side (`SIZE`), and centers it, so all ports read
  at about the same size. The margin is filled with the background color. The
  per-piece `scale` (default 1) fine-tunes one piece's size.
- Register the port in [index.js](index.js). That one entry adds it to the
  Daily Minimal thumbnail selection screen and to the wallpaper webapp's
  dropdown, which gets it through `src/shell/registry.js`.
- Naming: everything uses the design's ID from the archive, exactly as spelled
  there. The sketch is `<ID>.js`, its id is `'<ID>'`, and its thumbnail is
  `public/thumbs/<ID>.png` (e.g. `S02-404.js`, `IF-004.js`). The import name
  swaps hyphens for underscores (`S02_404`). The label is `'<ID> <Short Title>'`.
  Check the number and the series: a Série 2 design and a Série 1 design can
  share a number.
- [ported.csv](ported.csv) tracks which archived designs have been ported. It has
  one row per port: `id`, the archive `folder` and `file`, the `sketch` file, the
  `title`, and the `ported` date. The date is blank for ports made before this
  file existed. Its `id`, `folder` and `file` columns match the archive's
  `rename_manifest.csv`, so the two can be joined to see what's left.
- Paper textures come from [src/lib/paper.js](../../lib/paper.js):
  `paperCanvas` (block grain with specks) and `dotPaperCanvas` (1px dots), plus
  `fillPathWithTexture` to clip either one to a shape.
- The app shell labels every piece in the bottom-left corner with its ID and
  "Daily Minimal by Pierre Voisin" (`showCredit` in `src/main.js`, styled by
  `.dm-credit`). It uses the piece's id, so new ports get it automatically.
  Don't draw a credit inside the sketch.
- See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for the lifecycle contract,
  ambient vs. interactive modes, and controls/panels.

## Workflow for a new animated version

The full procedure is the project skill
[port-daily-minimal](../../../.claude/skills/port-daily-minimal/SKILL.md).
Agents load it when asked to port a design. In short:

1. Find the image, check `ported.csv`, and open it.
2. Measure it with the skill's `measure.py`, describe it in text, and get the
   owner's confirmation.
3. Ask the owner, with multiple-choice questions, how it should animate and
   whether and how it should be interactive.
4. Build it with `dmSketch()`, starting from the original as the rest pose.
   Register it in `index.js` and `ported.csv`.
5. Overlay the rest pose on the original (`shot.mjs` + `overlay.py`), tune, then
   run `ONLY=<ID> npm run thumbs`, `npm run build` and `npm run check`, and review
   it with the owner.

### Ideas for motion

- Rotate nested elements at different rates (like `S02-404`).
- Move the vanishing point or viewpoint (like `S02-582`).
- Build the image up stroke by stroke, hold it, then take it apart.
- Morph a parameter (count, spacing, angle) back and forth through the design.
- Move a wave, noise field or light source through the shapes.
- Let particles or trails flow inside the shape's bounds (like `S02-437`).

### Ideas for interaction

- The mouse position controls the main parameter (angle, spacing, phase, viewpoint).
- Click to reseed or restart, or to step to the next variation.
- Drag to rotate or reposition an element.
- Keys switch modes or palettes.
- None: ambient only.

Every interactive piece still needs an ambient mode that looks intentional
without input, because Plash may not forward the mouse.
