#!/bin/bash
# Run the BE Mastery Android shell on the emulator and save a screenshot.
#   bash scripts/emulator.sh <out.png> [wait-seconds]
# Boots the AVD headless if needed (Android Studio's SDK, AVD Medium_Phone_API_35 —
# override with AVD=…), installs the debug APK built by scripts/build.sh and opens it.
# A TWA build of com.bemastery.app on the emulator is signed with another key,
# so it is uninstalled first (emulator only — a real upgrade keeps the same upload key).
set -euo pipefail
OUT="${1:?out.png}"; WAIT="${2:-8}"
here="$(cd "$(dirname "$0")/.." && pwd)"
APK="$here/android/app/build/outputs/apk/debug/app-debug.apk"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
AVD="${AVD:-Medium_Phone_API_35}"
if ! "$ADB" devices | grep -q "emulator-.*device"; then
  if ! pgrep -f "emulator.*$AVD" >/dev/null; then
    nohup "$SDK/emulator/emulator" -avd "$AVD" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect >/tmp/be-emulator.log 2>&1 &
  fi
  echo "waiting for the emulator…"
  "$ADB" wait-for-device
  for i in $(seq 1 120); do
    if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then break; fi
    sleep 2
  done
fi
if ! "$ADB" install -r "$APK" >/dev/null 2>&1; then
  "$ADB" uninstall com.bemastery.app >/dev/null 2>&1 || true
  "$ADB" install "$APK" >/dev/null
fi
"$ADB" shell am force-stop com.bemastery.app >/dev/null 2>&1 || true
"$ADB" logcat -c || true
"$ADB" shell am start -n com.bemastery.app/.MainActivity >/dev/null
sleep "$WAIT"
"$ADB" exec-out screencap -p > "$OUT"
echo "saved $OUT"
"$ADB" logcat -d -s Capacitor:* Capacitor/Console:* chromium:E 2>/dev/null | grep -iE "error|uncaught|exception" | head -15 || true
