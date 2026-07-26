# Editor Improvement Plan

Inspired by [Sprite Fusion](https://www.spritefusion.com/), especially its [editor workflow](https://www.spritefusion.com/editor), [layer model](https://www.spritefusion.com/docs/tilemap-editor/editor/layers-and-collisions), and [export contract](https://www.spritefusion.com/docs/tilemap-editor/exporting-maps/export-overview).

## Goals

- Make tilemap authoring faster without hiding the pixel-art workflow.
- Make layers, collisions, and exports understandable at a glance.
- Keep Godot 4, Phaser, and JSON exports aligned with the same document.
- Preserve the local-first editor and avoid speculative engine integrations.

## Priority 1: Layer management

Replace the fixed `terrain`, `decoration`, and `foreground` controls with user-defined layers.

- Add, rename, duplicate, delete, reorder, hide, and lock layers.
- Mark layers as collision-enabled.
- Show a thumbnail, name, visibility state, lock state, and collision badge.
- Keep layer order consistent in the canvas and every export.
- Exclude hidden layers from exports.

This is the foundation for the rest of the plan. Sprite Fusion treats regular and autotile layers as explicit layer types and makes layer order part of authoring. [Reference](https://www.spritefusion.com/docs/tilemap-editor/editor/layers-and-collisions)

## Priority 2: Drawing tools

Add the smallest useful set of canvas tools:

- Pencil / brush
- Rectangle
- Line
- Fill
- Selection
- Eraser

Every tool should operate on the active layer, respect the current tile slice, and create one undo history entry per gesture.

## Priority 3: Separate project save from map export

Make the distinction visible in the UI:

- **Save project** stores the complete editor document, assets, layers, metadata, and rules.
- **Export map** creates a derived Godot 4, Phaser, JSON, or PNG output.

Use a labeled export menu instead of relying on icon-only buttons:

- Godot 4 `.tscn`
- Phaser/Tiled `.json`
- Canonical level `.json`
- Preview `.png`

Sprite Fusion documents project saving and map export as separate operations. [Reference](https://www.spritefusion.com/docs/tilemap-editor/exporting-maps/export-overview)

## Priority 4: Autotile terrain

Add an optional autotile layer for connected terrain, cliffs, walls, roads, and water.

Minimum viable version:

- One default tile.
- A 3×3 neighbor rule.
- Required, empty, and ignored neighbor states.
- Recalculate affected neighbors after draw, erase, fill, or move.

Later:

- Weighted variants for visual randomness.
- Reusable autotile presets.
- Import known autotile metadata from supported providers.

Sprite Fusion uses 3×3 rules and weighted variants for autotile resolution. [Reference](https://www.spritefusion.com/docs/tilemap-editor/editor/autotile-system)

## Priority 5: Tile attributes

Add optional metadata to tiles and layers:

- Collision
- Hazard
- Ladder
- Spawn
- Damage
- Animated
- Custom key/value properties

Export attributes consistently:

- Godot metadata or collision configuration.
- Phaser/Tiled tile or layer properties.
- Canonical JSON fields.

## Priority 6: Map-size overlay

Connect the current width control to the canvas visually.

- Show map width and height over the canvas.
- Draw the editable map bounds.
- Add resize handles or a resize mode.
- Keep the grid, bounds, and export dimensions visibly aligned.

## Visual direction

Keep the existing dark pixel-art identity while simplifying the chrome:

- Tilesets and layers on the left.
- Canvas as the visual focus in the center.
- Inspector and export controls on the right.
- Compact grouped toolbar at the top: Draw, Select, View, Export.
- Slightly lighter charcoal canvas surface with stronger grid contrast.
- One accent color for active tools and selected layers.
- Orange/red reserved for collision and destructive actions.
- Layer rows with thumbnail, name, visibility, lock, and collision state.
- Labeled export menu instead of several visually identical icons.

## Suggested implementation order

1. User-defined layer model and layer panel.
2. Fill, rectangle, and line tools.
3. Project save versus map export UI.
4. Autotile terrain layer.
5. Tile attributes.
6. Map-size overlay and resize interaction.

## Deliberate non-goals

- Do not add every engine export Sprite Fusion supports.
- Do not add cloud projects, accounts, or sync.
- Do not add a full TileSet authoring system before autotile needs it.
- Do not replace the current local-first browser storage model.
