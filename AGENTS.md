# Repository Guidelines

## Demo‑First Overview
This repo’s primary deliverable is the interactive demo in `demo/`, used to present the PDF editor. Optimize and iterate here first; the rest of the repo is reference and tooling.

## Project Structure
- `demo/index.html`: presentation entrypoint. Import map (demo/index.html:15) and viewer options (demo/index.html:65) live here.
- `demo/web/`: viewer UI used by the demo (e.g., `viewer.js`, `app.js`). Save logic triggers on download (demo/web/app.js:1265).
- `demo/src/`: library modules consumed by the demo (e.g., `pdf.worker.js`, `display/*`).
- `demo/external/`: assets (cmaps, fonts, icc) referenced via viewer options.
- `demo/l10n/`, `demo/locale/locale.json`: localization for labels and dialogs.
- Reference only: `src/`, `web/`, `test/`, `external/` (root).

## Run & Build
- Install once: `npm ci` (Node >= 20.16.x).
- Serve locally: `npx gulp server --port 8888` and open `http://localhost:8888/demo/index.html`.
- Lint (repo‑wide): `npx gulp lint` (add `--fix` to auto‑fix).

## Editing the Demo (what to tweak)
- Default PDF: change `defaultUrl` (demo/index.html:71). Place files under `demo/web/` and use relative paths.
- Feature toggles: enable/disable editor features in options (demo/index.html:65‑90).
- Auto‑enter editing: adjust tool mappings (demo/index.html:186‑203).
- Import map: add/retarget modules if you move files (demo/index.html:15‑55).
- Save/Download: “Download” button saves when edits exist (demo/web/app.js:1265‑1306).

## Coding Style
- ESM, 2‑space indent, semicolons. `web/` uses snake_case; `src/` may use dotted module names.
- Avoid unsanitized DOM; follow `eslint-plugin-no-unsanitized` rules. Run `npx gulp lint`.

## Commit & Pull Requests
- Commits: imperative, scoped when helpful (e.g., `demo: enable alt‑text by default`).
- PRs: include a short demo video/GIF, steps to reproduce, and what changed in `demo/`. Keep changes focused; don’t commit generated artifacts.
