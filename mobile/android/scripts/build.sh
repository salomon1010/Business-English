#!/bin/bash
# Build the BE Mastery Android shell (debug APK) from this Mac.
#   bash scripts/build.sh            production web bundle
#   bash scripts/build.sh --staging  staging web bundle (be-mastery-test Firebase, staging Workers)
# Toolchain: Capacitor 8 needs JDK 21 (brew openjdk@21) and SDK platform 36
# (the Bubblewrap SDK at ~/.bubblewrap/android_sdk has it).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.bubblewrap/android_sdk}"
cd "$here"
staging=false
if [ "${1:-}" = "--staging" ]; then staging=true; npm run --silent sync:staging; else npm run --silent sync; fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
# -PbeStaging=true → BuildConfig.BE_TEST_ADS: Google's test ad units only (a debug build is test-only anyway)
./gradlew --quiet -PbeStaging=$staging assembleDebug
apk="app/build/outputs/apk/debug/app-debug.apk"
ls -l "$apk" | awk '{printf "APK %s  %.1f MB\n", $9, $5/1048576}'
