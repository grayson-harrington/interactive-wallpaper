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

A few Série 2 pieces (e.g. S02-073, S02-085) were animated by
**David Rubio of Neutro studio** ([weareneutro.com](https://www.weareneutro.com)).
Credit Neutro studio too if one of those is ported.

This is a personal project. The source images are not committed to this repo
and should not be redistributed.

## Source images

The static originals were scraped from the Daily Minimal Pinterest boards and live
outside this repo:

```
/Users/graysonharrington/Documents/Programming/Daily Minimal/dm_scraping/downloads
```

The scraper project one level up (`dm_scraping/`) also has:

- `rename_manifest.csv` has one row per image: board, original pin file,
  new name, how the ID was found (`ok`, `ok-ocr`, `ok-metadata`), the OCR text,
  and the original Pinterest caption. Check it for a piece's official title or
  series name.
- `overrides.csv` lists IDs that were corrected by eye where the OCR and caption disagreed.
- `metadata/<board>.json` holds the raw Pinterest metadata per board.

### Organization

There is one folder per Pinterest board, 1,753 files in total
(1,674 jpg, 76 png, 1 gif, 1 m4v):

| Folder           | Files | Contents                                    |
| ---------------- | ----: | ------------------------------------------- |
| `série-n01/`     |   952 | Série 1, the main daily run (S01-001 to S01-999) |
| `circles/`       |   266 | Themed board: circle-based designs          |
| `polygons/`      |   152 | Themed board: polygon-based designs         |
| `triangles/`     |   116 | Themed board: triangle-based designs        |
| `latest-designs/`|    94 | The most recent posts, mixed series         |
| `lines/`         |    87 | Themed board: line-based designs            |
| `squares/`       |    73 | Themed board: square-based designs          |
| `c-collection/`  |     6 | [C] collection                              |
| `s-collection/`  |     5 | [S] collection                              |
| `t-collection/`  |     1 | [T] collection                              |

The themed boards (`circles`, `lines`, `polygons`, `squares`, `triangles`) are
mostly Série 2 plus special editions. A design can appear on more than one
board (59 IDs show up in more than one folder). Look up an ID across all folders
before assuming it's missing.

Files are named by the design's ID, taken from the caption or read off the image by OCR:

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

Other things to know:

- A `_2` suffix (e.g. `S01-480_2.jpg`) is a second image posted under the same ID.
- Files with long numeric names (e.g. `484488872392948100.jpg`) are pins whose ID
  couldn't be identified. The name is the Pinterest pin ID.
- `série-n01/484488872395094270.gif` and `latest-designs/484488872420468517.m4v`
  are original animations. Check their motion before designing your own.

## Where ports live in this app

- Each port is one file in this folder, built with `dmSketch()` from
  [harness.js](harness.js). The harness lets a piece draw in the original canvas
  coordinates. It fits that canvas to the screen and fills the margin with the
  background color.
- Register the port in [index.js](index.js). That one entry adds it to the
  Daily Minimal thumbnail selection screen and to the wallpaper webapp's
  dropdown, which gets it through `src/shell/registry.js`.
- Naming: everything uses the design's ID from the scrape, exactly as spelled
  there. The sketch is `<ID>.js`, its id is `'<ID>'`, and its thumbnail is
  `public/thumbs/<ID>.png` (e.g. `S02-404.js`, `IF-004.js`). The import name
  swaps hyphens for underscores (`S02_404`). The label is `'<ID> <Short Title>'`.
  Check the number and the series: a Série 2 design and a Série 1 design can
  share a number.
- [ported.csv](ported.csv) tracks which scraped designs have been ported. It has
  one row per port: `id`, the scrape `folder` and `file`, the `sketch` file, the
  `title`, and the `ported` date. The date is blank for ports made before this
  file existed. Its `id`, `folder` and `file` columns match `rename_manifest.csv`,
  so the two can be joined to see what's left.
- See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for the lifecycle contract,
  ambient vs. interactive modes, and controls/panels.

## Workflow for a new animated version

Take one image at a time. Don't write any code until steps 1 to 3 are done and the
project owner has confirmed each one.

### 1. Find and read the image

The owner names a piece (e.g. "S01-512" or "that circle one with the bands").
Find it under the downloads folder, checking every board. Open it with the
Read tool so you actually see it, and look up its row in `rename_manifest.csv`
for the title and caption.

### 2. Describe it back in text and get it confirmed

Before proposing anything, write a precise description of the static image so
the owner can confirm or correct how you read it. Include:

- **Canvas**: aspect ratio, estimated pixel size, background color.
- **Palette**: every color, with approximate hex values.
- **Elements**: each shape or group, with count, size, position and orientation,
  relative to the canvas (e.g. "8 concentric bands, each ~25px wide, alternating
  dark/light, centered").
- **Structure**: the rule that generates the image (grid, recursion, rotation
  symmetry, nesting, overlap/masking, even-odd fill) and anything that repeats.
- **Illusions and tricks**: implied 3D, impossible geometry, negative space.
- **Uncertainties**: anything you can't make out. Say it plainly rather than guessing.

Wait for confirmation. If the owner corrects anything, revise the description
and confirm again.

### 3. Ask how it should move, then how it should respond

Use the AskUserQuestion tool. Ask **one question for animation and one for
interactivity**. Each should give 2–4 concrete options specific to *this* image,
not generic ones. Put the option you recommend first and mark it
"(Recommended)". The owner can always pick "Other" and write in their own idea.

**Animation.** Base the options on the structure found in step 2. Examples:

- Rotate nested elements at different rates (like `S02-404`).
- Build the image up stroke by stroke, hold it, then take it apart.
- Morph a parameter (count, spacing, angle) back and forth through the design.
- Move a wave, noise field or light source through the shapes.
- Let particles or trails flow inside the shape's bounds (like `S02-437`).

**Interactivity.** Examples:

- The mouse position controls the main parameter (angle, spacing, phase).
- Click to reseed or restart, or to step to the next variation.
- Drag to rotate or reposition an element.
- Keys switch modes or palettes.
- None: ambient only.

If the answers leave open questions (speed, loop length, whether the original
still frame should appear at some point in the loop), ask a short follow-up
round the same way.

Every interactive piece still needs an ambient mode that looks intentional
without input, because Plash may not forward the mouse. Use `S.live` or
`p.interactive()` to switch between them, and a wandering stand-in for the
mouse where that fits. See CONTRIBUTING.md.

### 4. Build

- Match the original first. The still image should be a recognizable frame of
  the animation, with the same palette, proportions and composition.
- Set `ow`/`oh` to the original's aspect ratio and draw in those coordinates.
- Keep motion calm and loopable. This runs as a desktop wallpaper all day.
- Add a header comment with the ID, title, and a one-line description of the
  motion, like the existing ports.
- Register it in `index.js` in ID order and add its row to `ported.csv`.
- Run `npm run thumbs`, `npm run build` and `npm run check`, then reload Plash.
  `npm run thumbs` re-renders every thumbnail, so discard changes to thumbnails
  of other pieces before committing.

### 5. Review

Show the owner the result next to the original (screenshot plus image path).
Tweak until they're happy, then commit the port and its thumbnail together.
