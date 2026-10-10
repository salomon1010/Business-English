#!/bin/bash
# Build a SIGNED release bundle (.aab) of the Android shell for Google Play.
#   bash scripts/release.sh --staging     internal-testing build: staging services, TEST ads
#   bash scripts/release.sh               production build: production services, REAL ads
# The upload keystore stays outside the repo (the owner's playstore/ folder); its password
# is read from that folder's build.expect at run time and never printed or written anywhere.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
KS_DIR="${BE_KS_DIR:-$HOME/Documents/GitHub/Business-English/playstore}"
export JAVA_HOME="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.bubblewrap/android_sdk}"
export BE_KEYSTORE="$KS_DIR/android.keystore"
[ -f "$BE_KEYSTORE" ] || { echo "no keystore at $BE_KEYSTORE"; exit 1; }
BE_KEYSTORE_PASS="$(sed -nE '/-re \{Password\}/s/.*send "([^"]*)".*/\1/p' "$KS_DIR/build.expect" | sed 's/\\r$//')"
[ -n "$BE_KEYSTORE_PASS" ] || { echo "keystore password not found in build.expect"; exit 1; }
export BE_KEYSTORE_PASS BE_KEY_ALIAS=bemastery
cd "$here"
staging=false
rm -rf www   # a fresh bundle every time: a staging leftover (be-build.js) must never reach a production build
if [ "${1:-}" = "--staging" ]; then staging=true; npm run --silent sync:staging; else npm run --silent sync; fi
# Firebase config for notifications (FCM), kept outside the repo: production → be-mastery,
# --staging → be-mastery-test. Missing file = a build without push (BEPush.available() is false).
fb="$HOME/.config/be-mastery/firebase/google-services.$([ "$staging" = true ] && echo staging || echo production).json"
if [ -f "$fb" ]; then cp "$fb" android/app/google-services.json; else rm -f android/app/google-services.json; echo "note: $fb not found — building without notifications"; fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
./gradlew --quiet -PbeStaging=$staging bundleRelease
aab="app/build/outputs/bundle/release/app-release.aab"
ls -l "$aab" | awk '{printf "AAB %s  %.1f MB\n", $9, $5/1048576}'
"$JAVA_HOME/bin/keytool" -printcert -jarfile "$aab" 2>/dev/null | grep -m1 "SHA256:" || echo "WARNING: bundle not signed"
