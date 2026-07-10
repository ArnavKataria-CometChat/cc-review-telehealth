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
WORKSPACE="Telehealth.xcworkspace"

echo "==> iOS build gate: $SCHEME"

# Phase B added a CocoaPods dependency (CometChat). Pods/ is gitignored, so a
# fresh checkout must run `pod install` before the workspace can build. Install
# on demand, then build the workspace instead of the bare project.
BUILD_ARGS=(-project "$PROJECT")
if [ -f "Podfile" ]; then
  if [ ! -d "Pods" ] || [ ! -d "$WORKSPACE" ]; then
    echo "==> Pods not installed; running 'pod install'"
    pod install
  fi
  BUILD_ARGS=(-workspace "$WORKSPACE")
fi
echo "==> Building with: ${BUILD_ARGS[*]}"

# Build for the iOS Simulator SDK without pinning a specific booted device.
# The generic destination always resolves as long as an iOS Simulator runtime is
# installed, which is all a build-only gate needs (no device boot required).
DESTINATION="generic/platform=iOS Simulator"
echo "==> Destination: ${DESTINATION}"

xcodebuild \
  "${BUILD_ARGS[@]}" \
  -scheme "$SCHEME" \
  -sdk iphonesimulator \
  -configuration Debug \
  -destination "$DESTINATION" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build

echo "==> iOS build succeeded."
