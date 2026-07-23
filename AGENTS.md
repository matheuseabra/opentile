# Repository Guidelines

## Project Structure

- `src/main.jsx` contains the React/Vite editor, canvas interactions, level data, and exports.
- `src/styles.css` contains the pixel-art UI, editor layout, toolbars, picker, inspector, and debug styling.
- `docs/` contains setup, architecture, asset-pipeline, level-schema, shortcut, and export documentation.
- `vendor/pixel-art-fixer/` contains the bundled pixel-art cleanup implementation.
- `assets/` and generated files should remain separate from source code; do not commit large generated outputs unless explicitly required.

## Build, Test, and Development

```sh
./run.sh             # Start the local editor and pixel-fixer API
npm run build        # Create the production Vite bundle
./test.sh            # Run the repository smoke checks
```

The editor is served at `http://localhost:5173` when running locally. Run the build and smoke test after UI or interaction changes.

## Coding Style

Use two-space indentation for JavaScript, JSX, and CSS. Keep React behavior close to the component that owns it, prefer existing helpers and installed dependencies, and avoid speculative abstractions. Use `camelCase` for variables/functions, `PascalCase` for React components, and descriptive `kebab-case` CSS classes. Preserve the existing pixel-art visual language and native tooltip/accessibility labels on icon buttons.

## Testing Guidelines

There is no separate test framework currently; `./test.sh` is the smoke-test entry point and `npm run build` catches JSX and bundling errors. For interaction changes, manually verify the affected flow in the browser, including keyboard shortcuts and both Main Level and Gym where relevant.

## Commits and Pull Requests

Use short, imperative commit subjects such as `Fix level selection paste`. Keep changes focused. Pull requests should describe the user-visible behavior, list verification commands, mention persistence/export implications, and include a screenshot or short recording for editor UI changes.

## Configuration and Data Safety

The app stores assets in IndexedDB and level documents in browser `localStorage`. Do not add credentials or API keys to source files. Keep generated assets and downloaded exports out of commits unless they are intentional fixtures.
