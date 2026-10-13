#!/bin/bash
# Build one of the two App Store apps from this Mac.
#   bash scripts/build.sh                        General English, Simulator build (no signing)
#   bash scripts/build.sh welding                Welding English,  Simulator build (no signing)
#   bash scripts/build.sh [welding] --device     build for a real device (needs signing)
#   bash scripts/build.sh [welding] --archive    archive for the App Store (needs a Distribution profile)
#   bash scripts/build.sh [welding] --staging    bundle the staging web app (be-mastery-test, staging Workers)
#
# THE TWO-APP SPLIT (12 Oct 2026, docs/APP_SPLIT.md). One Xcode project, two apps:
#   general-english  com.lomonec.bemastery          (the existing app — project defaults)
#   welding          com.lomonec.bemastery.welding  (ios/App/Welding.xcconfig)
# The WEB bundle has to match the programme too, so this script syncs it and then
# VERIFIES BUNDLE_INFO.txt before xcodebuild runs: the two halves can never be
# crossed, which is the same guarantee verify<Variant>WebBundleProgramme gives on
# Android.
#
# Xcode is required. This Mac has it at /Applications/Xcode.app but xcode-select
# still points at the Command Line Tools, so DEVELOPER_DIR is set here rather than
# asking for the sudo that `xcode-select -s` needs.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
[ -d "$DEVELOPER_DIR" ] || { echo "Xcode not found at $DEVELOPER_DIR"; exit 1; }
cd "$here"

prog=general-english; staging=false; nobilling=false; mode=simulator
for a in "$@"; do
  case "$a" in
    --staging) staging=true ;;
    # a PRODUCTION bundle with Premium purchasing off, for a TestFlight round
    # that is not about billing (sync-web.mjs --no-billing explains why)
    --no-billing) nobilling=true ;;
    --device) mode=device ;;
    --archive) mode=archive ;;
    general|general-english) prog=general-english ;;
    welding) prog=welding ;;
    *) echo "usage: $(basename "$0") [general|welding] [--staging|--no-billing] [--device|--archive]"; exit 2 ;;
  esac
done

rm -rf www   # a fresh bundle every time: a staging leftover (be-build.js) must never reach a production build
if [ "$staging" = true ]; then node scripts/sync-web.mjs --track "$prog" --staging
elif [ "$nobilling" = true ]; then node scripts/sync-web.mjs --track "$prog" --no-billing
else node scripts/sync-web.mjs --track "$prog"; fi
npx cap sync ios

# the bundle and the build must be the same programme
got="$(sed -nE 's/^programme (.+)$/\1/p' www/BUNDLE_INFO.txt || true)"
[ "$got" = "$prog" ] || { echo "the web bundle is for '$got' but this is the $prog build"; exit 1; }
copied="ios/App/App/public/BUNDLE_INFO.txt"
[ -f "$copied" ] && [ "$(sed -nE 's/^programme (.+)$/\1/p' "$copied")" = "$prog" ] || { echo "ios/App/App/public was not refreshed for $prog"; exit 1; }

# The identity comes from the xcconfig (bundle ids, App Group, display name);
# the widget GALLERY is chosen at compile time, because WidgetBundleBuilder has
# no runtime branch — hence the Swift condition on the command line, which every
# target in the build sees.
xc=(xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release)
if [ "$prog" = welding ]; then xc+=(-xcconfig ios/App/Welding.xcconfig SWIFT_ACTIVE_COMPILATION_CONDITIONS=BE_WELDING)
else xc+=(SWIFT_ACTIVE_COMPILATION_CONDITIONS=BE_GENERAL); fi
case "$mode" in
  simulator) xc+=(-sdk iphonesimulator -destination "generic/platform=iOS Simulator" CODE_SIGNING_ALLOWED=NO build) ;;
  device)    xc+=(-sdk iphoneos -destination "generic/platform=iOS" build) ;;
  # -allowProvisioningUpdates lets automatic signing fetch or create the App
  # Store profiles from the signed-in account. Without it the first archive of a
  # NEW app (Welding, 12 Oct 2026) falls back to the team wildcard profile and
  # fails on App Groups, Push and Sign in with Apple. It is safe for an app whose
  # profiles already exist: Xcode reuses them.
  archive)   xc+=(-sdk iphoneos -destination "generic/platform=iOS" -archivePath "build/$prog.xcarchive" -allowProvisioningUpdates archive) ;;
esac
echo "+ ${xc[*]}"
"${xc[@]}" | tail -30
echo
"${DEVELOPER_DIR}/usr/bin/xcodebuild" -project ios/App/App.xcodeproj -scheme App -configuration Release \
  $([ "$prog" = welding ] && echo "-xcconfig ios/App/Welding.xcconfig") -showBuildSettings 2>/dev/null \
  | grep -E "^ +(PRODUCT_BUNDLE_IDENTIFIER|BE_APP_GROUP|BE_PROGRAMME|BE_DISPLAY_NAME|MARKETING_VERSION|CURRENT_PROJECT_VERSION) " || true
