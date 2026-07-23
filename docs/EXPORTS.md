# Export contract

## Level PNG

Exports the current rendered level canvas as `<level>-level.png`. This is a visual preview, not a tileset or asset bundle.

## Structured level JSON

Exports `<level>.level.json` using the schema in [LEVEL_EDITOR.md](LEVEL_EDITOR.md). This is the portable source format for future runtime importers.

## Godot scene

Exports `level.tscn` with used textures as `Sprite2D` regions and collision bodies. Copy the referenced PNG assets into the configured `res://art/` folder before opening the scene.

## Asset downloads

The asset download action exports uploaded source/processed files individually. It does not include the level layout.
