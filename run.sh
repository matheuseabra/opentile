#!/bin/sh
set -eu

python_bin="${PYTHON_BIN:-python3.13}"
if ! command -v "$python_bin" >/dev/null 2>&1; then
  echo "Python 3.11–3.13 is required for rembg. Set PYTHON_BIN to one." >&2
  exit 1
fi
if [ ! -x .venv/bin/python ]; then
  "$python_bin" -m venv .venv
fi
if ! .venv/bin/python -c 'import rembg' >/dev/null 2>&1; then
  .venv/bin/pip install 'rembg[cpu]'
fi

fixer_patch=../pixel-art-fixer-macos.patch
if git -C vendor/pixel-art-fixer apply --check "$fixer_patch" 2>/dev/null; then
  git -C vendor/pixel-art-fixer apply "$fixer_patch"
elif ! git -C vendor/pixel-art-fixer apply --reverse --check "$fixer_patch" 2>/dev/null; then
  echo "Could not apply the macOS pixel-fixer compatibility patch." >&2
  exit 1
fi

if [ ! -x vendor/pixel-art-fixer/rust/target/release/pixelfixer ]; then
  (cd vendor/pixel-art-fixer/rust && cargo build --release)
fi

tmp_dir=$(mktemp -d)
port_file="$tmp_dir/backend-port"
backend_pid=""
cleanup() {
  if [ -n "$backend_pid" ]; then kill "$backend_pid" 2>/dev/null || true; fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

PORT_FILE="$port_file" .venv/bin/python server.py &
backend_pid=$!
tries=0
while [ ! -s "$port_file" ] && [ "$tries" -lt 50 ]; do
  sleep 0.1
  tries=$((tries + 1))
done
if [ ! -s "$port_file" ]; then
  echo "Pixel fixer backend failed to start" >&2
  exit 1
fi

backend_port=$(sed -n '1p' "$port_file")
echo "React editor: http://localhost:5173"
VITE_BACKEND_PORT="$backend_port" npm run dev -- --host 127.0.0.1
