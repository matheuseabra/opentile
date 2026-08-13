#!/bin/sh
set -eu

python3 -m py_compile server.py
python3 -m unittest test_server.py
./scripts/build-pixel-fixer.sh
npm run test:lib --silent
tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT
vendor/pixel-art-fixer/rust/target/release/pixelfixer process \
	vendor/pixel-art-fixer/examples/frog.png "$tmp_dir/fixed.png" fast >/dev/null
test -s "$tmp_dir/fixed.png"
echo "ok"
