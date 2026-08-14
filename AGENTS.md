# Repository Guidelines

## Project Structure

- `src/main.tsx` contains the React/Vite editor, canvas interactions, level data, and exports.
- `src/styles.css` contains the pixel-art UI, editor layout, toolbars, picker, inspector, and debug styling.
- `docs/` contains setup, architecture, asset-pipeline, level-schema, shortcut, and export documentation.
- `assets/` and generated files should remain separate from source code; do not commit large generated outputs unless explicitly required.

## Build, Test, and Development

```sh
npm run dev          # Start the local editor
npm run build        # Create the production Vite bundle
npm run test:unit    # Run unit tests
npm run test:coverage # Show source coverage and enforce thresholds
```

The editor is served at `http://localhost:5173` when running locally. Run the build and smoke test after UI or interaction changes.

## Coding Style

Use two-space indentation for JavaScript, JSX, and CSS. Keep React behavior close to the component that owns it, prefer existing helpers and installed dependencies, and avoid speculative abstractions. Use `camelCase` for variables/functions, `PascalCase` for React components, and descriptive `kebab-case` CSS classes. Preserve the existing pixel-art visual language and native tooltip/accessibility labels on icon buttons.

## Testing Guidelines

`npm test` runs typecheck, library and component tests, and the production build. `npm run test:coverage` reports source coverage. For interaction changes, manually verify the affected flow in the browser, including keyboard shortcuts and both Main Level and Gym where relevant.

## Commits and Pull Requests

Use short, imperative commit subjects such as `Fix level selection paste`. Keep changes focused. Pull requests should describe the user-visible behavior, list verification commands, mention persistence/export implications, and include a screenshot or short recording for editor UI changes.

## Configuration and Data Safety

The app stores assets in IndexedDB and level documents in browser `localStorage`. Do not add credentials or API keys to source files. Keep generated assets and downloaded exports out of commits unless they are intentional fixtures.
