#!/bin/bash
# BE Mastery — show the streak countdown notification on the Android emulator:
# installs the debug APK, grants notifications, posts a sample through the debug
# preview screen, opens the shade and saves a PNG.
#   bash playstore/android-widget/dev-live.sh <apk> <out.png> [ge|pro|safe]
set -euo pipefail
APK="${1:?apk}"; OUT="${2:?out.png}"; KIND="${3:-ge}"
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
"$ADB" install -r -d "$APK" >/dev/null
"$ADB" shell pm grant com.bemastery.app android.permission.POST_NOTIFICATIONS 2>/dev/null || true
"$ADB" shell cmd notification cancel_all com.bemastery.app 2>/dev/null || true
"$ADB" shell am start -n com.bemastery.app/.widget.BEWidgetPreviewActivity --es live "$KIND" >/dev/null
sleep 2
"$ADB" shell cmd statusbar expand-notifications
sleep 2
"$ADB" exec-out screencap -p > "$OUT"
"$ADB" shell cmd statusbar collapse
echo "saved $OUT"
