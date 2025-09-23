# Repository Guidelines

## Project Structure & Module Organization
- `src/`: core library code (e.g., `pdf.js`, workers, sandbox, shared utils).
- `web/`: viewer UI, components, styles, and assets (e.g., `viewer.html`, `pdf_viewer.js`).
- `test/`: Jasmine unit and integration tests, PDFs, and harness.
- `examples/`, `demo/`: runnable samples for specific use cases.
- `external/`: third‑party tooling and build helpers.
- `l10n/`: localization resources. Generated/updated via tasks.
- `build/`: generated artifacts (do not commit).

## Build, Test, and Development Commands
- Install: `npm ci` (Node >= 20.16.x recommended).
- Build viewer (generic): `npx gulp generic` → `build/generic/`.
- Dev server: `npx gulp server --port 8888` (default 8888).
- Lint all: `npx gulp lint` (add `--fix` to auto‑fix where possible).
- Run tests: `npx gulp test` (full suite) or `npx gulp unittestcli` (CLI unit subset).
- Clean: `npx gulp clean`.

## Coding Style & Naming Conventions
- JavaScript modules (ESM) with 2‑space indentation and semicolons.
- Filenames follow existing folder patterns: `web/` uses snake_case (e.g., `text_layer_builder.js`); `src/` includes dotted module names (e.g., `pdf.worker.js`). Keep imports stable.
- Naming: camelCase for variables/functions, PascalCase for classes, SCREAMING_SNAKE_CASE for constants.
- Lint/format via ESLint, Stylelint, Prettier, and SVGLint. Use `npx gulp lint [--fix]`.
- Security: avoid unsanitized DOM usage; rules enforced by `eslint-plugin-no-unsanitized`.

## Testing Guidelines
- Frameworks: Jasmine (unit), Puppeteer‑driven integration, plus reftests.
- Locations: unit tests in `test/unit`, integration tests in `test/integration`.
- Run all tests with `npx gulp test`. For quick checks, use `npx gulp unittestcli`.
- Add tests for new features/bugfixes; include minimal PDFs under `test/pdfs/` when required.

## Commit & Pull Request Guidelines
- Commits: imperative mood, concise subject, optional scope (e.g., `viewer: fix zoom reset on load`). Reference issues (`Fixes #123`).
- PRs: clear description, linked issues, test plan, and screenshots/GIFs for UI changes (`web/`).
- Keep changes focused; do not commit `build/` outputs. Ensure `npx gulp lint` and `npx gulp test` pass.

## Notes for Agents/Contributors
- Follow existing headers and do not alter license text. Prefer `npx` over global CLIs. If adding dependencies, place vendor code under `external/` only when necessary.
