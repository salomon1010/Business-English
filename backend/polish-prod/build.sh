#!/bin/bash
# Build (and optionally deploy) the PRODUCTION be-polish: the code production ran before
# 10 Oct 2026 (deployed.js, fetched from Cloudflare then; only corsHeaders is exported)
# + ONLY the game route. See README.md — owner: "games only, everyone Free".
#   bash backend/polish-prod/build.sh            → dry run in a temp dir
#   bash backend/polish-prod/build.sh --deploy   → deploy to production
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
OUT="${TMPDIR:-/tmp}/polish-prod-pkg"; rm -rf "$OUT"; mkdir -p "$OUT"
cp "$HERE/entry.js" "$HERE/wrangler.toml" "$HERE/deployed.js" "$ROOT/backend/wm-game.js" "$ROOT/backend/rate-limit.js" "$OUT/"
cd "$OUT"
npx -y wrangler@4 deploy --dry-run --outdir dist | tail -6
if [ "${1:-}" = "--deploy" ]; then npx -y wrangler@4 deploy | tail -3; fi
