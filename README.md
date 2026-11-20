[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ginoray/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ginoray/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Leonida Cover Lab

An offline cover-art maker in the multi-panel poster style, built for the [make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01). Open `app/index.html` in a desktop browser — or serve the folder with `node serve.ts` and visit http://localhost:8080 — and the first paint is already a finished cover you can export.

## What it does

Drop in one photo or four and the lab builds a poster around them:

- **Layouts** — Hero Grid (one large panel plus a column of three), Classic Quad (2×2), Diagonal (slanted panel dividers) and Strips (three vertical panels), with thick dark, white or accent gutters. One photo can spread continuously across every panel, or each panel can carry its own photo; every photo pans by dragging and zooms with a slider.
- **Colour grades** — Vice Sunset, Neon Night, Golden Hour and Noir, each a canvas filter blend with its own gradient wash, plus an intensity slider, an optional halftone-dot screen and a vignette for a printed-poster feel.
- **Lettering** — a big uppercase title with a heavy dark outline and gradient fill (auto-wrapped onto two lines when that keeps it bigger), a letter-spaced subtitle with accent rules, and a rotatable starburst sticker with your own short text.
- **Export** — one render function drives the editor preview, the cover-only view and the file you save, at exactly 1080×1080, 1080×1350 or 1920×1080 PNG.

Everything is drawn with the canvas API from the photos and words you give it. Photos are read locally and never uploaded, the app makes no network requests, and it ships with four sample photos (a coast highway, a boulevard, a neon street and a pier) so it works the moment it opens. All artwork is original — no game logos, artwork, characters or fonts.

## Layout of this repository

- `app/` — the web app itself: `index.html`, `style.css`, the render engine in `app/src/cover.js`, the editor wiring in `app/src/main.js`, and the bundled samples in `app/samples/`.
- `main.ts` — the hand-in program (Node 22, standard library only). It validates the app, copies `app/` to the output, decodes the screenshots and writes the dossier with the vendored library in `vendor/makefun-app.ts`, which is left untouched.
- `screenshots/` — the entry's screenshots, stored as base64 text (`.b64`) and decoded back to JPEG by `main.ts`; `shots.json` records the staging query behind each one.
- `serve.ts` — a tiny local static server for trying the app.

## License

MIT — see `LICENSE`.
