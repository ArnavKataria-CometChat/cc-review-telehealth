#!/usr/bin/env bash
# Verify the telehealth backend component: install, type-check, compile, and
# run the Docker build gate. Exits non-zero on the first failure.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> [1/4] Installing dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "==> [2/4] Type-checking (tsc --noEmit)"
npm run typecheck

echo "==> [3/4] Building (tsc -> dist/)"
npm run build

echo "==> [4/4] Docker build gate"
if command -v docker >/dev/null 2>&1; then
  docker build -t telehealth-backend:verify .
else
  echo "ERROR: docker not found on PATH; the build gate requires Docker." >&2
  exit 1
fi

echo "==> OK: backend verified (type-check + build + docker build all passed)"
