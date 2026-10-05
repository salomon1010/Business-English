#!/bin/bash
# BE Mastery — build a DEBUG APK of the Play app with the widget, for an
# emulator or a test phone. Not the release path (docs/ANDROID_WIDGET.md §3).
#   bash playstore/android-widget/dev-build.sh <bubblewrap-project-dir>
# Uses Bubblewrap's own JDK and SDK (~/.bubblewrap), so nothing else must be
# installed. Prints the APK path at the end.
set -euo pipefail
DIR="${1:?usage: dev-build.sh <bubblewrap-project-dir>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
JDK="$(ls -d "$HOME"/.bubblewrap/jdk/jdk-17*/Contents/Home 2>/dev/null | head -1)"
[ -n "$JDK" ] || JDK="$(ls -d "$HOME"/.bubblewrap/jdk/jdk-17* | head -1)"
export JAVA_HOME="$JDK"
export ANDROID_HOME="$HOME/.bubblewrap/android_sdk"
cd "$DIR"
echo "sdk.dir=$ANDROID_HOME" > local.properties
node "$HERE/apply.mjs" .
./gradlew --no-daemon -q assembleDebug 2>&1 | grep -v '^$' | grep -iv 'warning: \[options\]\|deprecated\|^Note:' | tail -40 || true
APK="$(ls app/build/outputs/apk/debug/*.apk 2>/dev/null | head -1)"
if [ -z "$APK" ]; then echo "BUILD FAILED — no APK"; exit 1; fi
ls -la "$APK"
