#!/bin/bash
# BE Mastery — show the widget on the Android emulator, without placing it by
# hand: starts the AVD headless if needed, installs the debug APK, opens the
# debug preview screen (three sizes from a sample snapshot) and saves a PNG.
#   bash playstore/android-widget/dev-emulator.sh <apk> <out.png> [mood] [light] [pro]
#     mood: done | pending | risk | cold     light/pro: true | false
#     [empty] true | false   [gate] free (signed in, no Premium) | out (signed out)
# Needs Android Studio's SDK (~/Library/Android/sdk) with an AVD named
# Medium_Phone_API_35 (any name: set AVD=…).
set -euo pipefail
APK="${1:?apk}"; OUT="${2:?out.png}"; MOOD="${3:-done}"; LIGHT="${4:-false}"; PRO="${5:-false}"; EMPTY="${6:-false}"; GATE="${7:-}"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
AVD="${AVD:-Medium_Phone_API_35}"
if ! "$ADB" devices | grep -q "emulator-.*device"; then
  if ! pgrep -f "emulator.*$AVD" >/dev/null; then
    nohup "$SDK/emulator/emulator" -avd "$AVD" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect >/tmp/be-emulator.log 2>&1 &
  fi
  echo "waiting for the emulator…"
  "$ADB" wait-for-device
  for i in $(seq 1 90); do
    if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then break; fi
    sleep 2
  done
fi
"$ADB" install -r "$APK" >/dev/null
"$ADB" shell am force-stop com.bemastery.app >/dev/null 2>&1 || true
"$ADB" shell am start -n com.bemastery.app/.widget.BEWidgetPreviewActivity --es mood "$MOOD" --ez light "$LIGHT" --ez pro "$PRO" --ez empty "$EMPTY" ${GATE:+--es gate "$GATE"} >/dev/null
sleep 3
"$ADB" exec-out screencap -p > "$OUT"
echo "saved $OUT"
