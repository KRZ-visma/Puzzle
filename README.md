# Puzzle

A free-form **interlocking jigsaw** that runs entirely in the browser as a **Progressive Web App** (HTML, CSS, and JavaScript ES modules). Ready for GitHub Pages. Built for large piece counts (up to **1000**).

## Play locally

Modules and the service worker need an HTTP server (opening `index.html` as a file will not work):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Tests

Dev-only tooling (does not affect the static deploy):

```bash
npm ci
npx playwright install chromium
npm test                 # unit + Playwright
npm run test:unit
npm run test:e2e
```

Playwright is the primary suite; unit tests cover pure helpers (`geometry`, `groups`, `snap`, `rules`, …). See `AGENTS.md`.

## GitHub Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / root (`/`)
4. Save — the site will be at `https://<user>.github.io/Puzzle/`

## Versioning

Every merge/push to `main` runs **Stamp version on main**, which writes `version.json` (and bumps the service worker cache version). The app shows that version in the footer and periodically checks for a newer one, offering an **Update** banner when available.

On feature branches the version stays `dev` until merge.

## What’s included

- Cartoon farm landscape image (`assets/puzzle.jpg`)
- Canvas interlocking pieces with tab/blank edges
- Drag with Pointer Events; neighbor snap + board silhouette snap; moving groups
- Difficulty: 12 / 48 / 100 / 500 / 1000 pieces
- Shuffle, preview, and win screen
- Modular `js/` and `css/` layout to keep feature work separated
- PWA manifest, icons, offline shell, and self-update checks
- Playwright e2e + small Node unit tests

See `AGENTS.md` for coding-agent conventions (modules, `localStorage`, PWA, testing, conflict reduction).
