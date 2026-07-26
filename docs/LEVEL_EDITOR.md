# Level editor contract

The editor stores each level as a document with stable metadata and typed objects:

- `metadata`: `id`, `name`, `width`/`height` (tiles), and `backgroundSet`
- `layers`: ordered user-defined paint layers with visibility, lock, and collision settings
- `platforms`: `assetId`, `x`, `y`, optional `scale`, and `collision`
- `props`: `frameId`, `x`, `y`, and `depth`
- `pickups`: `pickupType`, `x`, and `y`
- `enemies`: `enemyId`, `x`, `y`, `facing`, and `tuning` overrides
- `exits`: `exitId`, `x`, `y`, collision bounds, and `targetAnimation`
- `tiles`: serializable painted cells with `x`, `y`, layer, asset name, and source-region coordinates
- `collisions`: painted collision cell keys such as `"4,12"`

The browser editor must provide level load/create/save/save-as controls, typed object creation, canvas selection, an absolute-position inspector, object deletion, asset labels, collision overlays, and horizontal scrolling for levels wider than the viewport.

Tile cells support ordered user-defined paint layers. Painting replaces only the active, visible, unlocked layer; rendering and exports preserve the same order and omit hidden layers. Transparent PNGs therefore reveal tiles beneath them; opaque source images should be processed with **Remove background** before placement.

An autotile layer treats the selected source tile as the top-left of a 3×3 block. Cardinal neighbours select required/empty edge variants; corners are ignored. If a full 3×3 block is unavailable, the selected tile is used as the fallback. Tile attributes (`collision`, `hazard`, `ladder`, `spawn`, `damage`, `animated`, and custom values) apply to new paint strokes.

Object mode uses the selected object’s X/Y gizmo. Dragging follows the dominant axis; hold Shift to constrain X or Option/Alt to constrain Y. Tile brush and rectangular selection remain separate from object mode.
