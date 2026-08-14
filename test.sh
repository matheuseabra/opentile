#!/bin/sh
set -eu

npm run typecheck
npm run test:lib
npm run build
echo "ok"
