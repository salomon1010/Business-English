#!/bin/bash
# BE Mastery — build and sign a RELEASE .aab of a Bubblewrap project with the widget
# and the streak countdown applied, for the Play internal-testing track.
#   bash playstore/android-widget/dev-release.sh <bubblewrap-project-dir> <out.aab>
# Signs with the upload key `bemastery` (KEYSTORE, default the owner's playstore copy);
# the password is read from that folder's build.expect, never printed or stored here.
set -euo pipefail
DIR="${1:?usage: dev-release.sh <project> <out.aab>}"; OUT="${2:?out.aab}"
HERE="$(cd "$(dirname "$0")" && pwd)"
KS="${KEYSTORE:-$HOME/Documents/GitHub/Business-English/playstore/android.keystore}"
EXP="$(dirname "$KS")/build.expect"
JDK="$(ls -d "$HOME"/.bubblewrap/jdk/jdk-17*/Contents/Home 2>/dev/null | head -1)"
export JAVA_HOME="$JDK" ANDROID_HOME="$HOME/.bubblewrap/android_sdk"
cd "$DIR"
echo "sdk.dir=$ANDROID_HOME" > local.properties
node "$HERE/apply.mjs" . >/dev/null
./gradlew --no-daemon -q bundleRelease 2>&1 | grep -iv 'warning\|deprecated\|^Note:\|^$' | tail -20 || true
AAB="app/build/outputs/bundle/release/app-release.aab"
[ -f "$AAB" ] || { echo "BUILD FAILED — no bundle"; exit 1; }
BE_PW="$(perl -ne 'print $1 if /Password\}\s*\{\s*send "([^"]*)\\r"/' "$EXP")"
[ -n "$BE_PW" ] || { echo "no password found in $EXP"; exit 1; }
export BE_PW
cp "$AAB" "$OUT"
"$JAVA_HOME/bin/jarsigner" -keystore "$KS" -storepass:env BE_PW -keypass:env BE_PW -sigalg SHA256withRSA -digestalg SHA-256 "$OUT" bemastery >/dev/null
"$JAVA_HOME/bin/jarsigner" -verify "$OUT" | tail -1
ls -la "$OUT"
