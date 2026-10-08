#!/bin/bash
# Everything that can be checked from this Mac before a commit touching the
# widgets: the app parses, the Worker and apply-script suites, and the two
# browser suites (iOS and Android web halves) on free ports.
#   bash playstore/android-widget/dev-verify.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
echo "== parse"
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;let n=0,bad=0,m;while((m=re.exec(h))){n++;try{new Function(m[1])}catch(e){bad++;console.log(e.message)}}console.log("scripts:",n,"errors:",bad)'
echo "== be-widget"; node backend/widget/test/run.mjs 2>&1 | grep "FAIL\|passed"
echo "== apply"; node playstore/android-widget/test/apply.test.mjs 2>&1 | grep "FAIL\|passed"
echo "== android-widget (browser)"; (cd tests && PORT=8491 node android-widget.mjs 2>&1 | grep "FAIL\|passed")
echo "== ios-widget (browser)"; (cd tests && PORT=8492 node ios-widget.mjs 2>&1 | grep "FAIL\|passed")
echo "== smoke"; (cd tests && PORT=8493 node smoke.mjs 2>&1 | tail -1)
echo "== git sees the Java"; git status --short playstore/android-widget | grep -c "java"
