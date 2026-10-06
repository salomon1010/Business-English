#!/bin/bash
# One-off ship of the tier spec (docs/TIERS.md): version bump, parse check,
# commit, push staging, deploy be-polish-staging (it carries the metering),
# restage the staging site and refresh the iOS bundle.
set -euo pipefail
cd "$(dirname "$0")/.."
CUR=$(grep -o 'be12-v[0-9]*' sw.js | head -1 | sed 's/be12-v//'); NEXT=$((CUR+1))
sed -i '' "s/const CACHE = \"be12-v$CUR\";/const CACHE = \"be12-v$NEXT\";/" sw.js
sed -i '' "s/const APP_VERSION=\"be12-v$CUR\";/const APP_VERSION=\"be12-v$NEXT\";/" index.html
echo "version be12-v$NEXT"
node -e 'const fs=require("fs");const h=fs.readFileSync("index.html","utf8");const re=/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;let n=0,bad=0,m;while((m=re.exec(h))){n++;try{new Function(m[1])}catch(e){bad++;console.log(e.message)}}console.log("scripts:",n,"errors:",bad);if(bad)process.exit(1)'
python3 -c "import json;json.load(open('mobile/ios/ios/App/App/BEMastery.storekit'))"
git add -A CLAUDE.md index.html sw.js privacy.html i18n docs backend mobile/ios/appstore mobile/ios/ios/App/App/BEMastery.storekit tests scripts
git commit -q -F - <<EOF
feat(tiers): the three tiers — metered AI verdicts, two plans, ads on General English only

Owner's tier spec, 5 Oct 2026 (docs/TIERS.md is now the source of truth).
Premium US\$2.99/month or US\$19.99/year, both offered, one subscription,
the same on General English and Welding.

- be-polish: the AI VERDICTS (analyse, assess, mvreport, chat report/coach)
  are METERED, not locked — 3 a day Free, 120 a day Premium (fair use), per
  UTC day in the RateLimiter DO (bucket verdict:<day>), 429 allowance
  {scope:"verdicts", limit, used, resetAt, plan}, header X-BE-Allowance with
  Access-Control-Expose-Headers. ytai metered in SECONDS of video per UTC day
  (1800 / 14400, whole video charged at 30 min), scope "video",
  X-BE-Video-Allowance. Tier from the entitlement view (plan premium + paid +
  ad_free). rate-limit.js consume() returns counts. Being heard stays unmetered.
- index.html: ENT_METERED (entLocked false for ai_analysis/ai_coach),
  aiAllowance/aiAllowOut/aiAllowNote/ytAllowNote, aiAllowTap in the one fetch
  wrapper, aiOff adds "spent", premLockHTML draws the allowance card only when
  spent (no offer for a paying learner), ppAiStart tells and offers; two-plan
  picker premOffers/premPick/premSaving (annual first, saving from the store's
  prices); adsTrackAllows() = isGeneralEnglish() again; PLAN_LIMITS_TRACK
  empty (2/1/1/1 and 100/20/50/30 on both programmes); benefit rows and the
  comparison table name the daily numbers, never "unlimited"; new copy keys,
  translated in fr/es/pt/ar, English in the other eleven.
- StoreKit fixture 2.99 / 19.99; App Store docs, privacy §7b (ads General
  English only), ADVERTISING / ENTITLEMENTS / PREMIUM-* / APPLE_STOREKIT /
  ADS-IOS-RELEASE docs; release reports marked superseded.
- Tests turned to the new contract: premium-gate 92, rate-limit 67,
  shadow-anon 17, ytai-tiers 23, premium-boundary 53, free-premium-contract
  89, welding-premium 43, premium-acquisition 41, ads 80/81 (N2b pre-existing),
  ios-ads 91, ad-resume 36, ad-shadow-pause 55, billing-preview 5,
  mobile-density 34 (16/17 were failing before: a stub that never reached the
  app, and the old "Welding never gated" rule), smoke 37.
- be12-v$NEXT.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
SHA=$(git rev-parse --short HEAD); echo "commit $SHA"
git push -q origin staging && echo "pushed"
(cd backend && npx wrangler deploy --env staging 2>&1 | grep -iE "deployed|error" | head -3)
SITE="$HOME/Developer/be-staging-site"; NEW="$SITE/stage-$SHA-v$NEXT"
rm -rf "$NEW"; mkdir -p "$NEW"; git archive HEAD | tar -x -C "$NEW"
python3 - "$NEW/index.html" <<'PY'
import sys,re,json
p=sys.argv[1]; h=open(p).read()
cfg=json.load(open('mobile/ios/staging-firebase.json')); cfg.pop('_note',None)
new='window.FB_CONFIG='+json.dumps(cfg,separators=(',',':'))+';   /* STAGING SNAPSHOT ONLY: be-mastery-test */'
h2,n=re.subn(r'window\.FB_CONFIG=\{[^}]*\};',new,h,count=1)
assert n==1 and 'be-mastery-test' in h2
open(p,'w').write(h2); print("FB_CONFIG swapped")
PY
ln -sfn "$NEW" "$SITE/current"
bash playstore/android-widget/dev-server.sh
(cd mobile/ios && node scripts/sync-web.mjs --staging 2>&1 | tail -1 && npx cap sync ios 2>&1 | tail -1 && echo "ios bundle $(grep -o 'be12-v[0-9]*' ios/App/App/public/sw.js | head -1)")
