#!/bin/bash
# The web checks that guard the Android-shell changes in index.html — both
# programmes (owner rule, 8 Oct 2026: Welding is always checked too).
#   bash mobile/android/scripts/verify-web.sh
set -uo pipefail
root="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$root"
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;let n=0,bad=0,m;while((m=re.exec(h))){n++;try{new Function(m[1])}catch(e){bad++;console.log(e.message)}}console.log("parse: scripts",n,"errors",bad);process.exit(bad?1:0)' || exit 1
cd tests
port=9100; fails=0
for t in smoke play-parity ios-ads ios-storekit ios-push ios-widget auth-entry-points track-isolation premium-boundary home-v2 welding-studio welding-shadow-rec welding-practice-career; do
  [ -f "$t.mjs" ] || { echo "skip $t (missing)"; continue; }
  port=$((port+1))
  PORT=$port node "$t.mjs" > "/tmp/vw-$t.log" 2>&1; rc=$?
  printf "%-26s exit %s · %s\n" "$t" "$rc" "$(tail -1 /tmp/vw-$t.log | cut -c1-60)"
  [ $rc -ne 0 ] && { fails=$((fails+1)); grep -h "FAIL" "/tmp/vw-$t.log" | cut -c1-220 | head -4; }
done
echo "suites failing: $fails"
