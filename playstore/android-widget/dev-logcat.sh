#!/bin/bash
# Launch the debug preview screen on the connected emulator and print what
# happened: the package's widget entries, am start's answer, any crash in
# logcat, then a screenshot.
#   bash playstore/android-widget/dev-logcat.sh <out.png> [mood] [light] [pro]
set -uo pipefail
OUT="${1:?out.png}"; MOOD="${2:-done}"; LIGHT="${3:-false}"; PRO="${4:-false}"
SDK="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
echo "== package"
"$ADB" shell dumpsys package com.bemastery.app | grep -i "widget\|versionName" | head -8
"$ADB" logcat -c
echo "== am start"
"$ADB" shell am start -W -n com.bemastery.app/.widget.BEWidgetPreviewActivity --es mood "$MOOD" --ez light "$LIGHT" --ez pro "$PRO" 2>&1 | tail -6
sleep 3
echo "== logcat"
"$ADB" logcat -d 2>/dev/null | grep -i "AndroidRuntime\|bemastery\|BEWidget\|FATAL" | tail -30
"$ADB" exec-out screencap -p > "$OUT"
echo "saved $OUT"
