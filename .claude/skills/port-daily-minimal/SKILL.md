---
name: port-daily-minimal
description: Port a static Daily Minimal design from the scraped image archive into an animated, interactive p5.js piece in this repo. Use when the user names a design ID (S01-123, S02-582, IF-004, SE-BS-012, DW-BH-003, ...), says "let's do/port/recreate a daily minimal", or asks to bring another Daily Minimal image over.
---

# Port a Daily Minimal design

Turn one static image from the scraped Daily Minimal archive into an animated,
interactive p5.js piece. The project owner decides how it moves and responds.
Your job is to read the image precisely, confirm that reading, offer good
options, and build a faithful port.

Background (archive layout, ID prefixes, attribution, naming) is in
[src/sketches/daily-minimal/README.md](../../../src/sketches/daily-minimal/README.md).
Read it first if you haven't this session.

- Archive: `/Users/graysonharrington/Documents/Programming/Daily Minimal/dm_scraping/downloads/<board>/<ID>.<ext>`
- Titles and captions: `dm_scraping/rename_manifest.csv`
- Already ported: `src/sketches/daily-minimal/ported.csv`

Don't write sketch code until steps 1–3 are done and the owner has confirmed each.

## 1. Find the image

- Check `ported.csv`. If the ID is already there, say so and ask whether to revise it.
- Search every board: `find "<downloads>" -name '<ID>.*'`. A design can be on several
  boards; any copy will do. Also grep its row in `rename_manifest.csv`.
- Mind the series. `S01-404` and `S02-404` are different designs. If the owner gives
  only a number, ask which series.
- Open the image with the Read tool so you actually see it.

## 2. Measure, describe, confirm

Don't estimate by eye. Use the measuring script (it needs Python with PIL and numpy):

```sh
SK=.claude/skills/port-daily-minimal
python3 $SK/measure.py "<image>" bbox              # artwork bounds (caption excluded)
python3 $SK/measure.py "<image>" row 485 265 735   # where lines cross a row, and the gaps
python3 $SK/measure.py "<image>" col 500           # same for a column
python3 $SK/measure.py "<image>" color 50 50       # exact color
```

Scan rows and columns just inside each edge to count divisions, and across the
middle to find nested elements. Check spacing for a pattern: equal steps, a
constant ratio, or neither (then hard-code the measured values). With S02-582, eyeballing
got two things wrong: the walls had different line counts (15/19/11), and the depth
frames shrank by a ratio rather than being evenly spaced in depth.

Then write a description for the owner:

- **Canvas**: size, background color. Leave out the "DAILYMINIMAL / NO. … / SERIE …"
  caption; it's a signature, not part of the design.
- **Palette**: every color, as hex.
- **Elements**: each shape or group, with count, size, position and orientation.
- **Structure**: the rule that generates it (grid, recursion, symmetry, perspective,
  nesting, masking, even-odd fill).
- **Illusions**: implied 3D, impossible geometry, negative space, moiré.
- **Uncertainties**: say plainly what you can't tell.

**Show the reading to the owner as visible reply text, then end your turn.** Put the
full description in your final message and close it by asking whether it's accurate.
Don't ask in the same turn. The owner can't see your thinking, and text written just
before a tool call can be collapsed out of view, so an AskUserQuestion sent right after
the description reaches them with nothing to confirm. Wait for their reply. If they
have corrections, apply them and show the revised reading the same way. Once the
reading is confirmed, go on to step 3. If a later measurement contradicts something the owner confirmed,
build from the measurement and tell the owner what changed.

The owner has said artwork should be centered in the port's canvas, even though the
original sits slightly above center to make room for its caption.

## 3. Choose animation and interaction

Use one AskUserQuestion call with a question for **animation** and one for
**interactivity**. Offer 2–4 options each, specific to this image's structure (see
the README for example kinds). Put your pick first and mark it "(Recommended)". Each
option says what the viewer sees.

The answers usually leave something open, such as the path of a wandering element,
the speed, the loop length, or how often it returns to the original. Ask a short
follow-up round the same way.

Rules for every piece:

- **The original is the rest pose.** Start on it, and have the animation return to it
  now and then or pass through it. The still image should be a recognizable frame.
- **Ambient mode must look intentional.** Plash may not forward the mouse, so
  interactive pieces also run without input. Switch on `S.live`, use `wanderer()`
  from the harness as a stand-in for the mouse, and when input stops, ease back into
  ambient instead of jumping.
- Keep motion calm and loopable. It runs all day as a wallpaper.

Record the confirmed description and choices in the plan before building.

## 4. Build

- New file `src/sketches/daily-minimal/<ID>.js` using `dmSketch()` from `harness.js`.
  Set `ow`/`oh` to the source image's pixel size (usually 1000×1000) and draw in those
  coordinates. Model it on
  [S02-582.js](../../../src/sketches/daily-minimal/S02-582.js): measured constants at
  the top, one draw function that takes the animated parameters, and a small
  state machine for ambient phases.
- Header comment: `// <ID> <title in lowercase>`, then a line or two on the motion.
- Time with `p.deltaTime` (capped) or frame counts. Never use raw `setTimeout`.
- **Paper texture.** Many originals have a paper grain on shapes or backgrounds. Zoom
  into the source to see which kind it is, then use the shared helpers in
  [src/lib/paper.js](../../../src/lib/paper.js). Don't write your own:
  - `paperCanvas(w, h, { base, grainAlpha, specks, ... })`: 2×2 white grain blocks
    plus brighter specks, for paper-textured shapes and faces (see `IF-004.js`,
    `S02-459.js`).
  - `dotPaperCanvas(w, h, { base, gray, alpha, soft })`: random 1px dots, for
    dark paper backgrounds (`S02-401.js`), or with `base: null` for a transparent
    grain layer drawn over shapes (`S02-368.js`).
  - `fillPathWithTexture(ctx, tex)` fills the current 2D path with a texture in
    the same coordinates, so any shape can be clipped to paper.

  Render textures once in `init`, never per frame. For shimmer, cycle a few
  pre-rendered layers, as `S02-368.js` does.
- Register it in `index.js` in ID order:
  `{ id: '<ID>', label: '<ID> <Short Title>', sketch: <ID with _ for -> }`.
  The shell adds the corner credit automatically. Don't draw one in the sketch.
- Add a row to `ported.csv`: `id,folder,file,sketch,title,ported`, with today's date.
- Follow CONTRIBUTING.md's lifecycle, energy and ambient/interactive rules.

## 5. Check fidelity

```sh
npm run build
node $SK/shot.mjs <ID> /tmp/rest.png 1500            # 1:1 render of the rest pose
python3 $SK/overlay.py "<image>" /tmp/rest.png /tmp/overlay.png --shift 0 <dy>
```

Use your scratchpad instead of `/tmp`. `<dy>` is how far the port moved the artwork
(e.g. 14 when centering a frame the original had at y≈485). Red is the source and
cyan is the port. Read the overlay and tune the constants until they line up, then
screenshot a few moments of the animation (`shot.mjs <ID> out.png 14000`) to see
the motion states.

## 6. Finish

```sh
ONLY=<ID> npm run thumbs      # just this piece's grid thumbnail
npm run build
ONLY=<ID> npm run check       # and MODE=interactive ONLY=<ID> npm run check
```

The server (launchd agent on :4747) must be running. Then tell the owner to reload
Plash. Report what you built, any measurements that differed from the confirmed
description, and any choice you made that they didn't (e.g. how a hidden wall
behaves once it becomes visible). Offer the overlay image. Commit only when asked,
following CLAUDE.md's git conventions.
