# Architecture

The app is intentionally local-first and currently has three main pieces:

- `src/main.tsx`: React UI and editor coordination.
- `src/lib/canvasEditor.ts`: tile selection, clipboard, deletion, and movement rules.
- `src/lib/assetLibrary.ts`: asset naming, image hydration, and IndexedDB lifecycle.
- `src/styles.css`: pixel-art UI, canvas layout, action rail, picker, inspector, and debug panel.
- `vendor/pixel-art-fixer/`: bundled cleanup implementation used by the local API.

## State ownership

- Assets: IndexedDB store `pixel-pipeline-assets` (`tiles` object store).
- Level documents: localStorage key `pixel-pipeline-levels`.
- Tile painting: in-memory refs for placed tiles, collisions, history, and redo; the serializable tile sketch is persisted in each level document.
- Object authoring: the active structured level document plus selected object state.

The canvas editing module and asset library module keep their domain rules behind small in-process seams. `main.tsx` coordinates them with React state and browser events; it does not reimplement tile movement or asset storage mechanics.

The canvas is a renderer, not the source of truth. Runtime `Map`/`Set` values are hydrated from each level document's serializable `tiles` and `collisions` fields, while structured objects remain in their typed buckets.
