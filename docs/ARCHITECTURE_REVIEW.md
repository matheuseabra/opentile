# Architecture review

This is a small, local-first pixel-art and level-sketching tool. It deliberately avoids a hosted backend: the browser owns authoring data, while a loopback-only Python process optionally runs the bundled pixel-grid fixer.

## System at a glance

```text
                        ./run.sh
                           |
              +------------+------------+
              |                         |
       Vite / React editor          server.py (127.0.0.1)
              |                         |
              | POST /api/fix           | invokes
              +------------------------>+--> bundled pixelfixer binary
              |
              +--> IndexedDB: uploaded asset blobs
              +--> localStorage: structured level documents
              +--> memory only: painted tiles, collisions, undo/redo
              |
              +--> browser downloads: PNG preview, JSON, .tscn, PNG assets
```

`vite.config.js` proxies `/api` to the Python server. `run.sh` builds the Rust fixer on first run, chooses a loopback port, starts `server.py`, and gives that port to Vite. The production Vite bundle has no fixer service; the editor intentionally disables the fixer away from localhost.

## Main pieces

| Area | Responsibility | Current implementation |
| --- | --- | --- |
| Browser editor | UI, editing rules, rendering, import and export | One React `App` component in `src/main.jsx`; canvas is used for the level viewport and React renders the surrounding controls. |
| Styling | Pixel-art layout and controls | `src/styles.css`. |
| Asset library | Keep source and processed images in the browser | IndexedDB database `pixel-pipeline-assets`, object store `tiles`, keyed by filename. The running app builds object URLs and `Image` objects from stored blobs. |
| Level documents | Persist typed runtime-facing objects | `localStorage` key `pixel-pipeline-levels`. A document contains metadata plus platform, prop, pickup, enemy, and exit arrays. |
| Tile sketch | Fast tile painting and collision overlay | `Map` and `Set` refs in `main.jsx`, keyed as `"x,y"`; undo/redo snapshots also live in memory. |
| Pixel cleanup | Clean an uploaded image locally | `server.py` accepts one multipart image, runs `vendor/pixel-art-fixer` for up to 30 seconds, and returns PNG output. |
| Exports | Produce portable browser downloads | Canvas PNG, structured level JSON, individual asset files, and a Godot `.tscn` made from painted tiles/collisions. |

## Editor data flow

1. An upload becomes a Blob in IndexedDB and an in-memory asset object (`name`, `url`, `image`, `blob`, `category`).
2. Painting writes the selected image region into `placedRef`; collision painting writes grid coordinates into `collisionsRef`.
3. Object authoring updates the active document in `levelDocs`, immediately serializing the complete document map to localStorage.
4. A canvas effect redraws the tile sketch, structured objects, grid, selection, and debug overlays whenever relevant React state changes.
5. Exports read either the canvas, `currentDoc`, or the in-memory tile/collision collections, depending on their target.

## Persistence and export boundaries

The project has two different level representations:

- The **structured document** is persistent and is the source for the JSON export. It stores objects and level metadata, but no painted tiles or tile-grid collisions.
- The **tile sketch** is the source for the Godot `.tscn` export and canvas preview. It is held only in `levelsRef`, `placedRef`, and `collisionsRef`, so it is lost on a page refresh and is not included in JSON.

The Godot export currently emits only painted tiles and their grid collision bodies. It does not export the structured platforms, props, pickups, enemies, or exits. That is a valid early sketcher boundary, but the user-facing docs should not imply a single canonical level format until the representations are joined.

## What is working well

- Local-first storage keeps asset work private and avoids account, sync, and deployment complexity.
- Browser-native canvas, IndexedDB, localStorage, and Blob downloads are a good fit for this single-user editor.
- Keeping the Rust fixer vendorized and exposing it only through a loopback process keeps the expensive image operation out of the UI bundle.
- The split between tile painting and typed game objects is a sensible domain distinction for Godot-oriented authoring.

## Improvements, in priority order

### 1. Persist the tile sketch with its level

**Why:** refreshes discard painted tiles and collisions, while the level dropdown suggests that a level is fully saved. JSON and `.tscn` therefore describe different parts of the same screen.

**Smallest useful change:** add a `tiles` array and `collisions` array to each level document, using asset names plus source-region coordinates instead of live image objects. Hydrate the `Map`/`Set` from those fields on load, and save them when a tile operation commits or the user saves. This makes JSON a real portable source format and preserves the existing fast `Map`/`Set` editing model.

### 2. Make one export contract explicit, then implement it

**Why:** the current JSON contains typed objects but no tiles; the current `.tscn` contains tiles but no typed objects.

**Smallest useful change:** choose one documented contract: either keep `.tscn` as a tile-sketch export and call the JSON the canonical full level, or add simple Godot nodes/groups for the structured objects. The first option is documentation plus the persistence work above; do it unless a Godot runtime already needs the objects in the scene.

### 3. Split `App` only along existing ownership boundaries

**Why:** `src/main.jsx` owns storage, canvas drawing, pointer logic, keyboard shortcuts, image processing, exports, and all JSX. It works today, but unrelated changes will increasingly collide.

**Smallest useful change:** extract pure helpers first (`levelDocument`, tile serialization, and export text generation), then move the canvas interaction code into one `LevelCanvas` component when it next needs material changes. Keep state in `App` initially; introducing a store or new state library now would add indirection without solving a current problem.

### 4. Add a focused browser-level persistence check

**Why:** `./test.sh` validates Python syntax and the fixer binary, and `npm run build` validates the frontend build, but neither catches the editor's main data-loss boundary.

**Smallest useful change:** add a tiny manual smoke checklist to the existing test instructions: upload asset, paint a tile, add an object, refresh, then verify both remain and JSON contains both representations. Automate this only once a browser test runner is otherwise needed.

### 5. Harden the local image endpoint when it becomes less local

**Why:** the server is appropriately bound to `127.0.0.1`, but its hand-rolled multipart parsing only needs to be robust enough for the current local UI.

**Smallest useful change:** retain the loopback binding and size/timeout limits. If the endpoint is ever exposed beyond localhost, replace the manual multipart parsing with a maintained parser and validate PNG/JPEG content before invoking the binary. Do not add that dependency for the present local-only service.

## Deferred on purpose

- No cloud sync, accounts, database, or API deployment: local-first is the stated product shape.
- No React state-management library: one component is awkward but still manageable; first make persisted data canonical.
- No Godot TileSet exporter: the project intentionally favors immediately importable `Sprite2D` scenes while layout is fluid.

## Suggested implementation sequence

1. Define and persist the tile/collision fields in the level document.
2. Update JSON/export documentation to declare that document canonical.
3. Verify refresh and export behavior manually; then decide whether Godot needs typed-object nodes.
4. Extract helpers/components only while making those changes.

This order fixes the data boundary before reorganizing code, which keeps the diff small and avoids creating abstractions around the current split state.
