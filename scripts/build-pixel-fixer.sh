#!/bin/sh
set -eu

root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
fixer_dir="$root/vendor/pixel-art-fixer"
patch_file="$root/patches/pixel-art-fixer-portable.patch"
binary="$fixer_dir/rust/target/release/pixelfixer"

if ! command -v cargo >/dev/null 2>&1; then
	echo "Rust/Cargo is required to build Pixel Art Fixer." >&2
	exit 1
fi
if [ ! -f "$fixer_dir/rust/Cargo.toml" ]; then
	echo "Pixel Art Fixer submodule is missing. Run: git submodule update --init --recursive" >&2
	exit 1
fi

if [ -f "$patch_file" ]; then
	if git -C "$fixer_dir" apply --check "$patch_file" 2>/dev/null; then
		git -C "$fixer_dir" apply "$patch_file"
	elif ! git -C "$fixer_dir" apply --reverse --check "$patch_file" 2>/dev/null; then
		echo "Could not apply the Pixel Art Fixer portability patch." >&2
		exit 1
	fi
fi

if [ ! -x "$binary" ]; then
	(cd "$fixer_dir/rust" && cargo build --release)
fi
