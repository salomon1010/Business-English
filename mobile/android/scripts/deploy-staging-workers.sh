#!/bin/bash
# Deploy the STAGING Workers from the repo (staging tracks the repo; production does not —
# see patch-deployed-origin.mjs for how production was given the Android origin).
#   bash mobile/android/scripts/deploy-staging-workers.sh
set -uo pipefail
B="$(cd "$(dirname "$0")/../../.." && pwd)/backend"
for d in . partner entitlements push events widget; do
  ( cd "$B/$d" && out=$(npx wrangler deploy --env staging 2>&1); rc=$?
    name=$(echo "$out" | grep -oE "Uploaded [a-z-]+" | head -1 | cut -d' ' -f2)
    ver=$(echo "$out" | grep -oE "Current Version ID: [0-9a-f-]+" | cut -d' ' -f4)
    printf "%-14s exit %s  %s %s\n" "$d" "$rc" "${name:-?}" "${ver:-}"
    [ $rc -ne 0 ] && echo "$out" | tail -5 )
done
