#!/bin/bash
# (Re)start the staging site's local server behind the cloudflared tunnel.
# Detached properly (no inherited stdout), so a caller's pipe never hangs on it.
#   bash playstore/android-widget/dev-server.sh
SITE="$HOME/Developer/be-staging-site"
pkill -f "http.server 8150" 2>/dev/null || true
sleep 1
cd "$SITE/current" || exit 1
nohup python3 -m http.server 8150 --bind 127.0.0.1 > "$SITE/server.log" 2>&1 < /dev/null &
disown
sleep 2
echo "server: $(lsof -iTCP:8150 -sTCP:LISTEN 2>/dev/null | tail -1 | awk '{print $1, $2}')"
echo "local:  $(curl -s --max-time 5 "http://127.0.0.1:8150/sw.js?x=$RANDOM" | grep -o 'be12-v[0-9]*' | head -1)"
echo "tunnel: $(curl -s --max-time 15 "https://staging.lomonec.com/sw.js?x=$RANDOM" | grep -o 'be12-v[0-9]*' | head -1)"
pgrep -x cloudflared >/dev/null && echo "tunnel process: up" || echo "tunnel process: DOWN"
