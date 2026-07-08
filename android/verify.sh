#!/usr/bin/env bash
#
# Build gate for the Telehealth Android client.
# Runs the native debug build and exits non-zero on any failure.
#
# Requires: JDK 17, ANDROID_HOME pointing at an SDK with platform 35/36 and
# build-tools installed (the Gradle wrapper handles Gradle/AGP/Kotlin).
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Telehealth Android — build gate (assembleDebug)"

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ] && [ ! -f local.properties ]; then
  echo "ERROR: Android SDK not found. Set ANDROID_HOME or create local.properties (sdk.dir=...)." >&2
  exit 1
fi

./gradlew --no-daemon :app:assembleDebug

echo "==> APK(s) produced:"
find app/build/outputs/apk -name '*.apk' -print

echo "==> BUILD OK"
