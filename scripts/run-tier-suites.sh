#!/bin/bash
# Runs every suite the tier spec (docs/TIERS.md) touches, each on its own port,
# and prints only the totals and the failing checks.
#   bash scripts/run-tier-suites.sh [suite ...]
cd "$(dirname "$0")/../tests" || exit 1
SUITES=${@:-"smoke premium-boundary free-premium-contract welding-premium ads ios-ads ad-resume ad-shadow-pause subscription premium-acquisition billing-preview monetization-qa mobile-density ios-widget android-widget"}
P=8620
for s in $SUITES; do
  P=$((P+1))
  [ -f "$s.mjs" ] || { echo "== $s: (no file)"; continue; }
  OUT=$(PORT=$P node "$s.mjs" 2>&1)
  echo "== $s: $(echo "$OUT" | grep -E "passed|pass +\(" | tail -1)"
  echo "$OUT" | grep -E "^\s+FAIL" | cut -c1-260
done
