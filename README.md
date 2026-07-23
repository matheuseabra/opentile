# Pixel Pipeline

Local, zero-key asset cleanup and Godot-level sketcher.

```sh
./run.sh
```

This starts the React/Vite editor at `http://localhost:5173` and the local Python fixer behind its `/api` proxy. Run `./test.sh` for the backend smoke check or `npm run build` for the React production build.

The active UI is `src/main.jsx`.

Project documentation is collected in [`docs/README.md`](docs/README.md), including setup, architecture, asset processing, shortcuts, level data, and export contracts.

1. Use `$imagegen` in Codex to generate a **single PNG sprite or a uniform sprite sheet**. Ask for a transparent or flat, high-contrast background, a fixed native frame size, hard edges, no text, no gradients, and a limited palette.
2. Upload it, then use **Fix pixel grid**. It invokes the bundled [Retro Diffusion Pixel Art Fixer](https://github.com/Retro-Diffusion/pixel-art-fixer) locally.
3. Use **Remove corner background** for simple flat/corner-connected backdrops; it makes those pixels transparent locally, without an API.
4. Paint a draft level, mark collision cells, download its used assets, then export `level.tscn`. Copy the PNGs into the matching `res://art/` location in your Godot project before opening the scene.

The editor deliberately produces `Sprite2D`s rather than a Godot `TileSet`: it imports every image immediately and has no tileset configuration ceremony. Move to a TileMap/terrain set after the layout stabilizes.

## Level authoring contract

Levels are authored as structured data rather than an anonymous tile map. The canonical shape is:

```json
{
  "metadata": { "id": "main", "name": "Main Level", "width": 48, "backgroundSet": "forest" },
  "platforms": [{ "assetId": "ground.png", "x": 4, "y": 12, "scale": 1, "collision": true }],
  "props": [{ "frameId": "tree.png:0,0", "x": 8, "y": 9, "depth": 2 }],
  "pickups": [{ "pickupType": "coin", "x": 10, "y": 8 }],
  "enemies": [{ "enemyId": "slime", "x": 14, "y": 12, "facing": "left", "tuning": {} }],
  "exits": [{ "exitId": "cave", "x": 46, "y": 12, "collision": { "w": 32, "h": 64 }, "targetAnimation": "fade" }]
}
```

The editor should support loading a level from the level dropdown, creating a level, saving over the current level, and saving a new copy. Objects are selected on the canvas and edited through a DOM inspector for absolute position, type-specific settings, and deletion. Selected objects expose X/Y gizmos for axis-constrained dragging; labels, collision overlays, and horizontal scrolling remain visible for wide levels.
