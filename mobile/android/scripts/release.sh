#!/bin/bash
# Build a SIGNED release bundle (.aab) of the Android shell for Google Play.
#   bash scripts/release.sh                       General English, production services, REAL ads
#   bash scripts/release.sh welding               Welding English, production services, REAL ads
#   bash scripts/release.sh [welding] --staging   internal-testing build: staging services, TEST ads
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
# THE TWO-APP SPLIT (12 Oct 2026): the first argument is the programme, so one
# command builds one app. `general` (com.bemastery.app) is the default and is the
# existing app, byte-for-byte the same identity as before. `welding`
# (com.lomonec.bemastery.welding) is the new one. The web bundle and the Gradle
# flavor must agree, and verify<Variant>WebBundleProgramme fails the build if
# they do not — so the two apps can never be crossed.
staging=false
prog=general
for a in "$@"; do
  case "$a" in
    --staging) staging=true ;;
    general|general-english) prog=general ;;
    welding) prog=welding ;;
    *) echo "usage: $(basename "$0") [general|welding] [--staging]"; exit 2 ;;
  esac
done
track=$([ "$prog" = welding ] && echo welding || echo general-english)
rm -rf www   # a fresh bundle every time: a staging leftover (be-build.js) must never reach a production build
if [ "$staging" = true ]; then npm run --silent sync-web -- --track "$track" --staging; else npm run --silent sync-web -- --track "$track"; fi
npx cap sync android
# Firebase config for notifications (FCM), kept outside the repo: production → be-mastery,
# --staging → be-mastery-test. Missing file = a build without push (BEPush.available() is false).
# google-services.json is per PACKAGE, so each app needs its own: the Welding
# package has to be registered as a second Android app in the Firebase project
# before it can receive notifications (docs/APP_SPLIT.md § Store actions).
# Until that file exists the Welding build simply has no push — BEPush.available()
# answers false and everything else works.
env=$([ "$staging" = true ] && echo staging || echo production)
fbdir="$HOME/.config/be-mastery/firebase"
fb="$fbdir/google-services.$prog.$env.json"
# the original file name, unchanged for the existing app (set -e: never a bare && chain)
if [ ! -f "$fb" ] && [ "$prog" = general ]; then fb="$fbdir/google-services.$env.json"; fi
if [ -f "$fb" ]; then cp "$fb" android/app/google-services.json; else rm -f android/app/google-services.json; echo "note: $fb not found — building without notifications"; fi
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
cd android
flavor=$([ "$prog" = welding ] && echo Welding || echo General)
./gradlew --quiet -PbeStaging=$staging "bundle${flavor}Release"
aab="app/build/outputs/bundle/${prog}Release/app-$prog-release.aab"
ls -l "$aab" | awk '{printf "AAB %s  %.1f MB\n", $9, $5/1048576}'
"$JAVA_HOME/bin/keytool" -printcert -jarfile "$aab" 2>/dev/null | grep -m1 "SHA256:" || echo "WARNING: bundle not signed"
