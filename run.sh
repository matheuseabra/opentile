#!/bin/sh
set -eu

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

PORT_FILE="$port_file" python3 server.py &
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
