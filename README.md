# Klondike Solitaire (Web)

A polished **3-card Klondike** solitaire web app with seeded deals, a daily challenge, and move/time tracking on win.

Inspired by [Savitr](https://github.com/taogroves/savitr) — same spirit of a static, open-in-browser experience with reproducible games via [seedrandom](https://github.com/davidbau/seedrandom).

The perfect-information solver lives in the sibling [solitaire-solver](../solitaire-solver) repository and is shipped here as prebuilt WebAssembly under `wasm/pkg/`.

## Play locally

```bash
cd solitaire-web
open index.html
```

Or serve the folder with any static server:

```bash
python3 -m http.server 8080
# visit http://localhost:8080
```

## Refreshing the Wasm solver

From the sibling `solitaire-solver` checkout:

```bash
wasm-pack build . --target web --out-dir ../solitaire-web/wasm/pkg
```

## Features

- **Vector SVG cards** — Simple or standard faces (5 filter styles), folder-based back styles with per-style colors (Card appearance screen)
- **3-card draw** from stock to waste; unlimited recycles when stock is empty
- **Random deal** or **custom seed** (any string)
- **Daily challenge** — same layout for everyone on a given calendar day (`YYYY-MM-DD`)
- **Timer** and **move counter**; both shown on the win screen
- **Touch-first** drag-and-drop; double-tap to auto-move to foundation
- **Felt green** table, card flip animations, confetti on win, procedural sound effects

## Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Draw / recycle stock | Click stock pile | Tap stock |
| Move cards | Drag | Drag |
| Auto to foundation | Double-click card | Double-tap card |

## Project layout

```
index.html
styles.css
assets/cards/         # Vector Playing Cards 3.2 (LGPL) — faces & backs
js/
  seedrandom.min.js   # MIT — David Bau
  cards.js            # Face style, back design & color
  engine.js           # Game rules & state
  solver.js           # Rust/Wasm solver loader
  ui.js               # Board rendering & input
  audio.js            # Web Audio sound effects
  app.js              # Menus & flow
wasm/pkg/             # wasm-pack output from solitaire-solver
scripts/
  extract-card-faces.py       # optional
  generate-backs-manifest.py  # scan assets/cards/backs/<style>/*.svg → backs-manifest.json
```

## Card artwork

Faces and backs are from [Vector Playing Cards 3.2](https://totalnonsense.com/open-source-vector-playing-cards/) by Chris Aguilar (LGPL 3.0). See `assets/cards/ATTRIBUTION.txt`.

## License

Game code: MIT. `seedrandom.min.js` retains its original license (see file header in upstream).
