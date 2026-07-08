#!/usr/bin/env bash
# Verify the telehealth web component: install, type-check, and run the Docker
# build gate (which also runs `next build`). Exits non-zero on the first failure.
set -euo pipefail

cd "$(dirname "$0")"

echo "==> [1/3] Installing dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "==> [2/3] Type-checking (tsc --noEmit)"
npm run typecheck

echo "==> [3/3] Docker build gate (next build inside the image)"
if command -v docker >/dev/null 2>&1; then
  docker build -t telehealth-web:verify .
else
  echo "ERROR: docker not found on PATH; the build gate requires Docker." >&2
  exit 1
fi

echo "==> OK: web verified (type-check + docker build passed)"
