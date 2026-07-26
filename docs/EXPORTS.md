# Export contract

## Level PNG

Exports the current rendered level canvas as `<level>-level.png`. This is a visual preview, not a tileset or asset bundle.

## Structured level JSON

Exports `<level>.level.json` using the schema in [LEVEL_EDITOR.md](LEVEL_EDITOR.md), including serializable painted `tiles`, tile attributes, layers, autotile metadata, and `collisions`. This is the portable source format for future runtime importers.

## Godot scene

Exports `level.tscn` with used textures as `Sprite2D` regions, tile attributes as Godot metadata, and collision bodies. It reads the hydrated sketch from the active level document. Visible layers are emitted in render order. Copy the referenced PNG assets into the configured `res://art/` folder before opening the scene.

## Phaser tilemap

Exports `<level>.phaser.tilemap.json` as Tiled-compatible JSON: visible user-defined tile layers (in editor order), object layers for `collisions` and tile attributes, and image tilesets referenced from `art/`. Layer collision is exported as a Tiled layer property. Load it with Phaser's Tiled tilemap loader and copy the downloaded assets into the matching `art/` path.

## Asset downloads

The asset download action exports uploaded source/processed files individually. It does not include the level layout.
