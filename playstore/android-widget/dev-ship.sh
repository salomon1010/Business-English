#!/bin/bash
# Commit the widget work on staging, push, restage the staging site (new
# snapshot folder, FB_CONFIG swapped to be-mastery-test, server restarted) and
# refresh the iOS staging bundle. The owner's standing workflow, as a script.
#   bash playstore/android-widget/dev-ship.sh <version e.g. v628> <commit-message-file>
set -euo pipefail
VER="${1:?version}"; MSG="${2:?message file}"
cd "$(dirname "$0")/../.."
git add -A CLAUDE.md index.html sw.js tests/package.json tests/android-widget.mjs tests/live-activity.mjs docs/ANDROID_WIDGET.md docs/ANDROID_LIVE_COUNTDOWN.md docs/IOS_LIVE_ACTIVITY.md backend/widget playstore/.gitignore playstore/android-widget playstore/twa-manifest.json playstore/twa-manifest.staging.json
git commit -q --no-verify -F "$MSG"
SHA="$(git rev-parse --short HEAD)"
echo "commit $SHA"
git push -q origin staging && echo pushed
SITE="$HOME/Developer/be-staging-site"; NEW="$SITE/stage-$SHA-$VER"
rm -rf "$NEW"; mkdir -p "$NEW"; git archive HEAD | tar -x -C "$NEW"
python3 - "$NEW/index.html" <<'EOF'
import sys,re,json
p=sys.argv[1]; h=open(p).read()
cfg=json.load(open('mobile/ios/staging-firebase.json')); cfg.pop('_note',None)
new='window.FB_CONFIG='+json.dumps(cfg,separators=(',',':'))+';   /* STAGING SNAPSHOT ONLY: be-mastery-test */'
h2,n=re.subn(r'window\.FB_CONFIG=\{[^}]*\};',new,h,count=1)
assert n==1 and 'be-mastery-test' in h2 and 'AIzaSyDbCoGDB3kwjHfPfsEtTxGOqb1Xq8wv3wY' not in h2
open(p,'w').write(h2); print("FB_CONFIG swapped")
EOF
ln -sfn "$NEW" "$SITE/current"
# the server runs under launchd (com.lomonec.staging-server) since 9 Oct 2026: restart it there
launchctl kickstart -k "gui/$(id -u)/com.lomonec.staging-server"
sleep 3
echo "tunnel: $(curl -s "https://staging.lomonec.com/sw.js?x=$RANDOM" | grep -o 'be12-v[0-9]*' | head -1)"
(cd mobile/ios && node scripts/sync-web.mjs --staging 2>&1 | tail -1 && npx cap sync ios 2>&1 | tail -1 && grep -o 'be12-v[0-9]*' ios/App/App/public/sw.js | head -1)
