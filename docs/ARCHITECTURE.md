# Architecture

The app is intentionally local-first and currently has three main pieces:

- `src/main.jsx`: React UI, canvas renderer, editor interactions, IndexedDB asset loading, and localStorage level documents.
- `src/styles.css`: pixel-art UI, canvas layout, action rail, picker, inspector, and debug panel.
- `vendor/pixel-art-fixer/`: bundled cleanup implementation used by the local API.

## State ownership

- Assets: IndexedDB store `pixel-pipeline-assets` (`tiles` object store).
- Level documents: localStorage key `pixel-pipeline-levels`.
- Tile painting: in-memory refs for placed tiles, collisions, history, and redo.
- Object authoring: the active structured level document plus selected object state.

The canvas is a renderer, not the source of truth. Tile maps and structured objects are kept separately so exports can target the appropriate format.
