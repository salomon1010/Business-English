#!/bin/bash
# Where things stand after a ship: the commit, the push, the staging snapshot,
# the server, the tunnel's version and the iOS bundle's version.
cd "$(dirname "$0")/../.."
echo "== head";   git log --oneline -1
echo "== origin"; git fetch -q origin staging 2>/dev/null; git log --oneline -1 origin/staging
echo "== tree";   git status --short | grep -v node_modules | head -5
echo "== snapshot"; readlink "$HOME/Developer/be-staging-site/current"
echo "== server"; lsof -iTCP:8150 -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print $1, $2}'
echo "== tunnel";  curl -s --max-time 10 "https://staging.lomonec.com/sw.js?x=$RANDOM" | grep -o 'be12-v[0-9]*' | head -1
echo "== ios bundle"; grep -o 'be12-v[0-9]*' mobile/ios/ios/App/App/public/sw.js 2>/dev/null | head -1
