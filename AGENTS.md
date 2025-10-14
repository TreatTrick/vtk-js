# Repository Guidelines

## Project Structure & Module Organization
- `Sources/`: Core library modules (ESM) and TypeScript typings (`index.d.ts`). Tests live beside code under `Sources/**/test/`.
- `Examples/`: Runnable examples (`index.js`, optional `controlPanel.html`, `index.md`).
- `Utilities/`: Build, example runner, data converters, CI helpers.
- `Documentation/`: Doc generation config and scripts (uses `kw-doc`).
- `patches/`: `patch-package` patches applied during `build:pre`.

## Build, Test, and Development Commands
- `npm run build:release`: Lints, then builds ESM and UMD to `dist/`.
- `npm run dev:umd` / `npm run dev:esm`: Watch builds for local development.
- `npm test`: Run Karma test suite; `npm run test:headless` for CI.
- `npm run lint` / `npm run lint-fix`: Lint (Airbnb + Prettier) and auto-fix.
- `npm run example`: Serve examples; `example:webgpu` enables WebGPU (`WEBGPU=1 NO_WEBGL=1`).

## Coding Style & Naming Conventions
- Indentation: 2 spaces; trailing commas; single quotes per Prettier (`prettier.config.js`).
- Linting: ESLint (Airbnb, Prettier integration). Run `npm run lint` before PRs.
- Naming: `camelCase` for variables/functions, `PascalCase` for classes. Module layout follows `Sources/<Area>/<Component>/index.js` (+ `index.d.ts`).

## Testing Guidelines
- Frameworks: Karma + Tape; coverage via `karma-coverage` and `nyc` (targets `Sources/**/*.js`).
- Location: Place tests in `Sources/**/test/*.js`. Use descriptive filenames (e.g., `testImageWindowLevel.js`).
- Rendering tests may include PNG baselines; keep images small and deterministic.
- Commands: `npm test`, `npm run test:firefox`, `npm run test:debug`.

## Commit & Pull Request Guidelines
- Conventional Commits enforced by commitlint. Use Commitizen: `npm run commit`.
- Commit scope should map to a top-level area (e.g., `Rendering`, `Filters`, `Core`).
- PRs must include: clear description, linked issues, rationale, and screenshots/GIFs for visual changes.
- Pre-submit: `npm run lint`, `npm run typecheck`, `npm run test:headless`.

## Additional Notes
- Public API: Update corresponding `.d.ts` and docs when changing APIs.
- Assets: Avoid committing large datasets; prefer `Utilities/DataGenerator`.
- WebXR/WebGPU: Use example scripts; feature flags via environment as shown above.
- Agents: Keep diffs minimal; follow structure and do not reformat unrelated files.

