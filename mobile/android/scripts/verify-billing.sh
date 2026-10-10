#!/bin/bash
# Billing + Premium suites (the TWA's Digital Goods path must be untouched) and both programmes.
#   bash mobile/android/scripts/verify-billing.sh
set -uo pipefail
cd "$(cd "$(dirname "$0")/../../.." && pwd)/tests"
port=9300
for t in android-shell billing-client billing-preview monetization-qa subscription premium-value premium-acquisition premium-boundary ios-storekit welding-premium smoke track-isolation welding-studio; do
  [ -f "$t.mjs" ] || { echo "skip $t (missing)"; continue; }
  port=$((port+1))
  PORT=$port node "$t.mjs" > "/tmp/vb-$t.log" 2>&1; rc=$?
  printf "%-22s exit %s · %s\n" "$t" "$rc" "$(tail -1 /tmp/vb-$t.log | cut -c1-60)"
  [ $rc -ne 0 ] && grep -h "FAIL" "/tmp/vb-$t.log" | cut -c1-200 | head -3
done
