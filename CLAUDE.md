# Interactive Wallpaper

Personal creative-coding pieces (Processing/Python originals ported to p5.js),
served by a local Node server so [Plash](https://sindresorhus.com/plash) shows them
as a live macOS desktop background. Vite builds `src/` into `dist/`. A dependency-free
server (`server/server.mjs`, launchd agent on port 4747) serves `dist/` plus live image
folders and shared state. Owner: Grayson Harrington.

- [README.md](README.md): what the app is, setup, commands, layout.
- [CONTRIBUTING.md](CONTRIBUTING.md): the rules every piece follows. Read it before
  adding or changing a piece.
- [src/sketches/daily-minimal/README.md](src/sketches/daily-minimal/README.md): the
  Daily Minimal ports, the source image archive, and attribution.

## Working here

- **Plash only sees `dist/`.** After any change under `src/`, run `npm run build`,
  then tell the owner to reload Plash. The server needs a restart only for changes to
  `server/server.mjs`.
- **Verify with the real app**, not just by reading code. With the server up
  (`curl localhost:4747/api/health`):
  - `npm run check` (`ONLY=<key>` for one piece, `MODE=interactive` for the other mode,
    `BROWSER=webkit` for Plash's engine).
  - Look at the screenshots in `check-out/`. A blank canvas can still pass.
- **Every piece needs an ambient mode.** Plash may not forward input, so pieces play
  themselves until `p.interactive()` (or `S.live` in the Daily Minimal harness) says
  someone is using the page. Test both `?mode=ambient` and `?mode=interactive`.
- **Energy budget.** It runs all day: cap frame rates, `noLoop()` when settled, keep
  hot loops allocation-free, and cap anything that accumulates.
- **Lifecycle.** Use `p.schedule()` instead of raw timers, call `noLoop()` at the end of
  `draw()` and never in `setup()`, and repaint in `p.onActivate`. Details are in
  CONTRIBUTING.md.
- **UI.** Per-piece panels go bottom-right (`corner-br`); the shell's menu is top-right.
  The bottom-left is the Daily Minimal credit or a piece's key HUD. Use the helpers in
  `src/lib/panel.js`.
- No save/export features and no audio. Personal images in `images/*/` stay out of git.
- Match the surrounding code: p5 instance mode, small focused modules, a short header
  comment on each sketch saying what it does and how it moves.

## Design decisions go to the owner

For anything visual or behavioral that the owner hasn't decided (how a piece moves,
what input does, colors, timing), ask with AskUserQuestion. Give 2–4 concrete options,
with your recommendation first and marked "(Recommended)". Don't pick silently. If you
had to choose something along the way, say so in your report.

## Daily Minimal ports

Porting a design from the scraped archive has its own project skill,
[port-daily-minimal](.claude/skills/port-daily-minimal/SKILL.md). Use it whenever the
owner names a design ID (e.g. `S02-582`) or asks to port a Daily Minimal. Files,
ids and thumbnails are named by the exact design ID (`S02-404.js`). Every port is
listed in `ported.csv`. The original designs are by Pierre Voisin; keep the credit.

## Git and GitHub

- Remote: `github.com/grayson-harrington/interactive-wallpaper`. Work happens on
  `main` directly; there are no feature branches or PRs unless the owner asks for one.
- **Commit or push only when the owner asks.** Pushing is a separate request from
  committing.
- One logical change per commit. Split unrelated work into separate commits,
  e.g. a new piece versus a shell feature.
- Message format, matching the history:
  - Subject: `<Piece or area>: <imperative summary>`, e.g.
    `Flow Pipes: pick ambient moves by strict priority tiers` or
    `Daily Minimal: show the design ID and credit in the bottom-left corner`.
    Use the piece's display name. Keep it under ~72 characters and don't end it
    with a period.
  - Optional body, wrapped at ~72 characters, saying what changed and why.
  - End with the `Co-Authored-By` trailer given in the session's attribution
    instructions.
- Commit a Daily Minimal port together with its thumbnail and `ported.csv` row.
  Don't commit other thumbnails that a full `npm run thumbs` re-rendered.
- Never commit `dist/`, `check-out/`, `.state.json`, or anything in `images/*/`.
  They're gitignored; don't force-add them.
