#!/bin/bash
# Run the Worker test suites touched by the Android-shell allow-list change.
#   bash mobile/android/scripts/verify-workers.sh
set -uo pipefail
cd "$(cd "$(dirname "$0")/../../.." && pwd)/backend"
for t in test-premium-gate.mjs test-rate-limit.mjs push/test/apns.mjs push/test/nudge.mjs widget/test/run.mjs events/test/run.mjs entitlements/test/billing.mjs partner/test/run.mjs mail/test/run.mjs; do
  [ -f "$t" ] || { echo "skip $t (missing)"; continue; }
  timeout_s=600
  node "$t" > "/tmp/vwk-$(echo $t | tr / _).log" 2>&1; rc=$?
  printf "%-34s exit %s · %s\n" "$t" "$rc" "$(tail -1 "/tmp/vwk-$(echo $t | tr / _).log" | cut -c1-70)"
  [ $rc -ne 0 ] && grep -hiE "FAIL|not ok|Error" "/tmp/vwk-$(echo $t | tr / _).log" | cut -c1-200 | head -4
done
