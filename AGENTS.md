# Agent instructions — Puzzle

## Project

Browser-based classic picture puzzle (jigsaw-style grid). Players select pieces and place them on a board until the image is complete. Hosted as a static **Progressive Web App** on **GitHub Pages**.

Features beyond the current basics are still being defined — prefer small, incremental changes and confirm product direction before large gameplay redesigns.

## Stack (keep it this way unless asked otherwise)

- **Vanilla HTML, CSS, and JavaScript only** — no React, Vue, bundlers, or build step
- **ES modules** via `<script type="module">` (needs a local HTTP server; file:// will fail)
- **PWA** — `manifest.webmanifest` + root `sw.js` service worker; installable / offline-capable shell
- Static files at the repo root so GitHub Pages can serve `main` `/` directly
- No backend, no npm dependencies, no package manager required to run
- **Persistence uses the browser only** — anything that needs to be stored (progress, settings, preferences, etc.) goes in **`localStorage`** through `js/storage.js`. Do not add a server, database, or cloud sync unless explicitly requested.

If a requested feature truly cannot work well in plain JS (e.g. heavy 3D), explain tradeoffs first; default answer is still vanilla web tech.

## Layout

| Path | Role |
|------|------|
| `index.html` | Page structure only — keep markup changes here |
| `styles.css` | CSS entry that `@import`s partials — do not dump feature styles here |
| `css/tokens.css` | Design tokens / CSS variables |
| `css/base.css` | Reset, page background, shared keyframes |
| `css/chrome.css` | Header, brand, controls, stage panels |
| `css/board.css` | Board grid, slots, piece look |
| `css/tray.css` | Piece tray |
| `css/modals.css` | Preview / win dialogs |
| `css/pwa.css` | Version label + update banner |
| `js/main.js` | App entry — wire controls, PWA, and start |
| `js/game.js` | Core state and placement rules |
| `js/board.js` | Board rendering / slot drop targets |
| `js/tray.js` | Tray rendering |
| `js/pieces.js` | Piece element factory |
| `js/ui.js` | Status, progress, modals, chrome bindings |
| `js/dom.js` | DOM element references |
| `js/config.js` | Image path, difficulties, storage prefix |
| `js/utils.js` | Pure helpers (shuffle, background math) |
| `js/storage.js` | `localStorage` get/set helpers |
| `js/pwa.js` | Service worker registration + update checks |
| `sw.js` | Service worker (cache shell; `CACHE_VERSION` stamped on main) |
| `manifest.webmanifest` | PWA manifest |
| `version.json` | Displayed app version (stamped on merge to `main`) |
| `.github/workflows/stamp-version.yml` | Generates version on pushes to `main` |
| `assets/puzzle.jpg` | Current puzzle image |
| `assets/icons/` | PWA icons |
| `README.md` | Human setup / Pages docs |

## Modularize to reduce merge conflicts

Prefer **small, ownership-clear modules** over growing one file. When two agents touch different concerns, they should usually edit different files.

| If you are changing… | Prefer editing… |
|----------------------|------------------|
| Difficulties / image path / storage key prefix | `js/config.js` |
| Save / load / settings persistence | `js/storage.js` |
| Piece DOM / drag wiring | `js/pieces.js` |
| Board grid / slots | `js/board.js` + `css/board.css` |
| Tray layout / fill | `js/tray.js` + `css/tray.css` |
| Status text, modals, header buttons | `js/ui.js` + `css/chrome.css` / `css/modals.css` |
| Placement rules / win condition / selection state | `js/game.js` |
| PWA update UX / version checks | `js/pwa.js` + `css/pwa.css` |
| Offline cache list / SW strategies | `sw.js` (keep `CACHE_VERSION` markers intact) |
| Bootstrap / startup only | `js/main.js` |
| Colors / fonts | `css/tokens.css` |

Guidelines:

1. **Do not re-monolith** — avoid merging modules back into one `game.js` / giant CSS file
2. **Add a new module** when a feature has a clear boundary (timer, sound, gallery, etc.) rather than stuffing it into `game.js`
3. **Keep callbacks injected** across board/tray/pieces so UI modules do not own game state
4. **Touch the fewest files** needed for the task; do not “cleanup refactor” unrelated modules in the same PR
5. **CSS belongs with the feature** — board look in `css/board.css`, not in `chrome.css`
6. **When adding cacheable static files**, also add them to the `SHELL` list in `sw.js`

## Versioning & updates

- **`version.json` is authoritative** for the on-screen version
- On every push to **`main`** (typically a merged PR), `.github/workflows/stamp-version.yml` writes:
  - `version.json` → `YYYY.MM.DD.<run_number>` plus short SHA
  - `sw.js` `CACHE_VERSION` → same string (so clients detect a new worker)
  - commit message includes `[skip ci]` to avoid loops
- Do **not** hand-edit production versions on `main`; let the workflow stamp them
- Feature branches may keep `"version": "dev"`
- The app checks for updates on load, on tab focus, on reconnect, and on an interval via `js/pwa.js` (compares `version.json` + `registration.update()`). When an update is ready, show the banner; applying it activates the waiting worker and reloads

## How the game works today

- Image is sliced into a rectangular grid via CSS `background-position` / `background-size` on piece buttons
- Difficulties: **12 (4×3)**, **24 (6×4)**, **48 (8×6)** — defined in `DIFFICULTIES` in `js/config.js`
- Interaction: **click piece → click board slot**, plus HTML5 **drag-and-drop**
- Correctly placed pieces lock; misplaced pieces can be moved again
- Dropping onto an occupied slot sends the previous piece back to the tray
- Win when every slot holds its matching piece id (`pieceId === slotIndex`)

Piece ids are row-major: `id = row * cols + col`.

## Conventions for agents

1. **Preserve static GitHub Pages deploy** — do not introduce a required build pipeline without an explicit request
2. **Store client data in `localStorage`** via `js/storage.js` — namespaced keys (`puzzle:…`), JSON for structured data
3. **Keep modules readable** — small functions, clear exports; avoid frameworks and heavy abstractions
4. **Match existing UI language** — Fredoka + Nunito, soft landscape-inspired palette in `css/tokens.css`; avoid generic purple/glow “AI default” aesthetics unless redesign is requested
5. **Mobile matters** — board and tray must remain usable on small screens; PWA should remain installable
6. **Assets** — keep puzzle images reasonably sized for the web; put them under `assets/`
7. **Scope** — only change files needed for the task; do not rewrite README or restyle everything casually
8. **Local check** — `python3 -m http.server 8080` from the repo root and open `http://localhost:8080` (modules + SW require HTTP)

## Out of scope for now (define later)

Examples that may come later; do not implement unless asked:

- Irregular jigsaw piece shapes / interlocking tabs
- Multiple puzzle images / gallery
- Timer, scoring, save/resume via `localStorage`, accounts
- Sound effects, particle-heavy celebrations
- Touch-specific gestures beyond click + drag

## Git / deploy notes

- Default branch for the live site is `main`
- Pages expects root `index.html` (not `/docs` unless that is deliberately changed)
- Prefer clear commit messages that say what the player-facing change is
- Prefer one concern per PR/branch when practical so reviews and merges stay narrow
- After merge to `main`, wait for the **Stamp version on main** workflow before expecting the footer version to change in production
