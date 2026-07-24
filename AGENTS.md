# Agent instructions — Puzzle

## Project

Browser-based classic picture puzzle (jigsaw-style grid). Players select pieces and place them on a board until the image is complete. Hosted as a static site on **GitHub Pages**.

Features beyond the current basics are still being defined — prefer small, incremental changes and confirm product direction before large gameplay redesigns.

## Stack (keep it this way unless asked otherwise)

- **Vanilla HTML, CSS, and JavaScript only** — no React, Vue, bundlers, or build step
- Static files at the repo root so GitHub Pages can serve `main` `/` directly
- No backend, no npm dependencies, no package manager required to run
- **Persistence uses the browser only** — anything that needs to be stored (progress, settings, preferences, etc.) goes in **`localStorage`** (or related Web Storage APIs). Do not add a server, database, or cloud sync unless explicitly requested.

If a requested feature truly cannot work well in plain JS (e.g. heavy 3D), explain tradeoffs first; default answer is still vanilla web tech.

## Layout

| Path | Role |
|------|------|
| `index.html` | Page structure: header controls, board, tray, modals |
| `styles.css` | Visual design and layout (desktop + mobile) |
| `game.js` | All puzzle logic (IIFE, no modules/build) |
| `assets/puzzle.jpg` | Current puzzle image |
| `README.md` | Human setup / Pages docs |

## How the game works today

- Image is sliced into a rectangular grid via CSS `background-position` / `background-size` on piece buttons
- Difficulties: **12 (4×3)**, **24 (6×4)**, **48 (8×6)** — defined in `DIFFICULTIES` in `game.js`
- Interaction: **click piece → click board slot**, plus HTML5 **drag-and-drop**
- Correctly placed pieces lock; misplaced pieces can be moved again
- Dropping onto an occupied slot sends the previous piece back to the tray
- Win when every slot holds its matching piece id (`pieceId === slotIndex`)

Piece ids are row-major: `id = row * cols + col`.

## Conventions for agents

1. **Preserve static GitHub Pages deploy** — do not introduce a required build pipeline without an explicit request
2. **Store client data in `localStorage`** — never invent a backend for saves; keep keys namespaced (e.g. `puzzle:…`) and JSON-serialize structured data
3. **Keep `game.js` readable** — small functions, clear DOM wiring; avoid frameworks and heavy abstractions
4. **Match existing UI language** — Fredoka + Nunito, soft landscape-inspired palette in `styles.css` CSS variables; avoid generic purple/glow “AI default” aesthetics unless redesign is requested
5. **Mobile matters** — board and tray must remain usable on small screens
6. **Assets** — keep puzzle images reasonably sized for the web; put them under `assets/`
7. **Scope** — only change files needed for the task; do not rewrite README or restyle everything casually
8. **Local check** — `python3 -m http.server 8080` from the repo root and open `http://localhost:8080`

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
