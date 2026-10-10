#!/bin/bash
# Expose the running app's WebView (debug builds only) on localhost:9222 so a test can drive it.
#   bash scripts/webview.sh     → prints the forwarded socket
set -euo pipefail
ADB="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}/platform-tools/adb"
pid=$("$ADB" shell pidof com.bemastery.app | tr -d '\r')
[ -n "$pid" ] || { echo "app not running"; exit 1; }
"$ADB" forward --remove tcp:9222 >/dev/null 2>&1 || true
"$ADB" forward tcp:9222 "localabstract:webview_devtools_remote_$pid" >/dev/null
echo "webview of pid $pid on http://127.0.0.1:9222"
curl -s http://127.0.0.1:9222/json/version | head -5
