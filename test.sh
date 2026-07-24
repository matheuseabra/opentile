#!/bin/sh
set -eu

python3 -m py_compile server.py
python3 -m unittest test_server.py
node --input-type=module -e 'import { putTile, removeTile, tilesFor } from "./src/lib/tileLayers.js"; const grass = { asset: "grass" }, rock = { asset: "rock" }; const stack = putTile(grass, "decoration", rock); if (tilesFor(stack).length !== 2 || removeTile(stack, "decoration").terrain !== grass) process.exit(1)'
if REMOVE_BG_API_KEY= python3 -c 'import server; server.remove_background(b"")' >/dev/null 2>&1; then
  echo "remove.bg accepted a missing API key" >&2
  exit 1
fi
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
vendor/pixel-art-fixer/rust/target/release/pixelfixer process \
  vendor/pixel-art-fixer/examples/frog.png "$tmp_dir/fixed.png" fast >/dev/null
test -s "$tmp_dir/fixed.png"
echo "ok"
