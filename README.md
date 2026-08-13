# ▓▓ OpenTile

> **Pixel-art cleanup → tile painting → level sketch → game-ready exports**

OpenTile is a local-first pixel-art level editor for quickly sketching 2D
levels. It keeps assets in IndexedDB and level documents in browser storage;
the optional image-processing bridge runs only on your machine.

```text
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  IMAGEGEN    │ → │  PIXEL FIX   │ → │  LEVEL GRID  │
│  sprites     │   │  hard edges  │   │  Godot .tscn │
└──────────────┘   └──────────────┘   └──────────────┘
```

![OpenTile editor](docs/editor-screenshot.png)

## Run locally

### Requirements

- Node.js `^20.19.0 || >=22.12.0`
- Python 3.11–3.13 (for local background removal)
- Rust/Cargo (for the bundled pixel-art fixer)
- Git

Clone with the fixer submodule, install JavaScript dependencies, and start the
editor:

```sh
git clone --recurse-submodules https://github.com/matheuseabra/opentile.git
cd opentile
npm ci
./run.sh
```

Open <http://localhost:5173>. If you cloned without submodules, run
`git submodule update --init --recursive` before starting.

### Verify

```sh
npm run build
npm test
```

## Pixel-art workflow

1. Prepare a single PNG sprite or uniform sprite sheet. Hard edges, a fixed
   frame size, no text or gradients, and a limited palette work best.
2. Upload it to the editor. Uploads are processed locally by rembg and fall
   back to the original file if removal fails.
3. Choose **Fix pixel grid** when the result needs the bundled
   [Retro Diffusion Pixel Art Fixer](https://github.com/Retro-Diffusion/pixel-art-fixer)
   locally.
4. Paint tiles, mark collision cells, place objects, and export a PNG preview,
   structured JSON, or `level.tscn`.

Copy exported PNGs into the matching `res://art/` folder before opening the
Godot scene. The editor intentionally exports `Sprite2D`s instead of a
configured Godot `TileSet`, keeping the sketching loop fast.

## Level data

Levels use a structured document with `metadata`, `platforms`, `props`,
`pickups`, `enemies`, and `exits`. See the complete schema and examples in
[`docs/README.md`](docs/README.md) and [`docs/LEVEL_EDITOR.md`](docs/LEVEL_EDITOR.md).

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for local-development and pull-request
guidance. Report vulnerabilities privately using [SECURITY.md](SECURITY.md).
OpenTile is released under the [MIT License](LICENSE); the bundled
pixel-art fixer remains subject to its own license.

## Project map

```text
src/main.tsx       React/Vite editor
src/styles.css     pixel-art UI styling
server.py          loopback image-processing bridge
assets/            intentional sample/generated art
vendor/            bundled pixel-art fixer
docs/              setup, schema, shortcuts, and export notes
```
