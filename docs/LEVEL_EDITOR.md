# Level editor contract

The editor stores each level as a document with stable metadata and typed objects:

- `metadata`: `id`, `name`, `width` (tiles), and `backgroundSet`
- `platforms`: `assetId`, `x`, `y`, optional `scale`, and `collision`
- `props`: `frameId`, `x`, `y`, and `depth`
- `pickups`: `pickupType`, `x`, and `y`
- `enemies`: `enemyId`, `x`, `y`, `facing`, and `tuning` overrides
- `exits`: `exitId`, `x`, `y`, collision bounds, and `targetAnimation`

The browser editor must provide level load/create/save/save-as controls, typed object creation, canvas selection, an absolute-position inspector, object deletion, asset labels, collision overlays, and horizontal scrolling for levels wider than the viewport.

Tile cells support three paint layers: `terrain`, `decoration`, and `foreground`. Painting replaces only the active layer, while rendering and Godot export draw them in that order. Transparent PNGs therefore reveal the terrain beneath a decoration; opaque source images should be processed with **Remove background** before placement.

Object mode uses the selected object’s X/Y gizmo. Dragging follows the dominant axis; hold Shift to constrain X or Option/Alt to constrain Y. Tile brush and rectangular selection remain separate from object mode.
