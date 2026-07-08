#!/usr/bin/env bash
#
# Build gate for the iOS client. Builds the app for the iOS Simulator WITHOUT
# code-signing and exits non-zero on any failure. This is the native gate the
# monorepo's CI runs for the `ios/` component.
#
set -euo pipefail

cd "$(dirname "$0")"

SCHEME="Telehealth"
PROJECT="Telehealth.xcodeproj"

echo "==> iOS build gate: $SCHEME ($PROJECT)"

# Pick a concrete available simulator runtime/device where possible; fall back
# to a generic destination if none is found (xcodebuild still builds for the
# iphonesimulator SDK either way).
DESTINATION="generic/platform=iOS Simulator"
if command -v xcrun >/dev/null 2>&1; then
  DEVICE_ID="$(xcrun simctl list devices available 2>/dev/null \
    | grep -Eo '\([0-9A-F-]{36}\)' | head -n1 | tr -d '()' || true)"
  if [ -n "${DEVICE_ID:-}" ]; then
    DESTINATION="id=${DEVICE_ID}"
  fi
fi
echo "==> Destination: ${DESTINATION}"

xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination "$DESTINATION" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build

echo "==> iOS build succeeded."
