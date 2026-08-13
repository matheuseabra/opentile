#!/bin/sh
set -eu

if [ -n "${PYTHON_BIN:-}" ]; then
	python_bin="$PYTHON_BIN"
else
	for candidate in python3.13 python3.12 python3.11; do
		if command -v "$candidate" >/dev/null 2>&1; then
			python_bin="$candidate"
			break
		fi
	done
fi
if [ -z "${python_bin:-}" ] || ! command -v "$python_bin" >/dev/null 2>&1; then
	echo "Python 3.11–3.13 is required for rembg. Set PYTHON_BIN to one." >&2
	exit 1
fi
if ! "$python_bin" -c 'import sys; raise SystemExit(not ((3, 11) <= sys.version_info[:2] <= (3, 13)))'; then
	echo "Python 3.11–3.13 is required for rembg. Set PYTHON_BIN to one." >&2
	exit 1
fi
if [ ! -x .venv/bin/python ]; then
	"$python_bin" -m venv .venv
fi
if ! .venv/bin/python -c 'import rembg' >/dev/null 2>&1; then
	.venv/bin/pip install -r requirements.txt
fi

./scripts/build-pixel-fixer.sh

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
