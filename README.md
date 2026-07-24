# Puzzle

A classic click-and-place picture puzzle that runs entirely in the browser — HTML, CSS, and JavaScript (ES modules). Ready for GitHub Pages.

## Play locally

Modules need an HTTP server (opening `index.html` as a file will not work):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## GitHub Pages

1. Repo **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / root (`/`)
4. Save — the site will be at `https://<user>.github.io/Puzzle/`

## What’s included

- Cartoon farm landscape image (`assets/puzzle.jpg`)
- Click a piece, then click a board slot to place it (drag-and-drop also works)
- Difficulty: 12 / 24 / 48 pieces
- Shuffle, preview, and win screen
- Modular `js/` and `css/` layout to keep feature work separated

See `AGENTS.md` for coding-agent conventions (modules, `localStorage`, conflict reduction).

Features to define next can build on this foundation.
