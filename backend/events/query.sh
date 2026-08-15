#!/usr/bin/env bash
# ============================================================================
# BE Mastery — read the product-event numbers.
#
#   ./query.sh                 list the questions it can answer
#   ./query.sh login           save the token once, so it stops asking
#   ./query.sh dashboard       build the visual report and open it
#   ./query.sh events          which events fired, last 7 days
#   ./query.sh people          installed app vs open web, last 30 days
#   ./query.sh funnel          arrive -> finish onboarding -> practise
#   ./query.sh weeks           where in the 12 weeks people stop
#   ./query.sh stage           how far along the people opening it are
#   ./query.sh countries       which markets to translate for next
#   ./query.sh raw "SELECT …"  anything else
#
# Needs a Cloudflare API token with Account -> Account Analytics -> Read.
# Make one at: dash.cloudflare.com -> My Profile -> API Tokens -> Create Token
#              -> Custom token -> Account -> Account Analytics -> Read
#
# WHERE THE TOKEN IS KEPT, AND WHY NOT HERE
# -----------------------------------------
# `./query.sh login` writes it to ~/.config/be-mastery/events.env, chmod 600 —
# OUTSIDE this repository, deliberately. Everything committed here is served
# publicly from app.lomonec.com (this very file is downloadable), so a token in
# a repo-local .env is one careless `git add -A` away from being published to
# the open web and fetchable over HTTP. Outside the repo it cannot be committed
# by any mistake, so the safe thing needs no discipline to stay safe.
# Order of preference: $CF_TOKEN, then that file, then ask.
# ============================================================================
set -euo pipefail

ACCOUNT="${CF_ACCOUNT:-8d3cd584749c92c7076d30688dde2a1d}"
DATASET="be_events"
TOKEN_FILE="${CF_TOKEN_FILE:-$HOME/.config/be-mastery/events.env}"

usage(){ sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

ask_token(){ printf 'Cloudflare API token (input hidden): ' >&2; read -rs REPLY_TOK < /dev/tty; echo >&2; }

WHAT="${1:-}"
[ -z "$WHAT" ] && usage 0

if [ "$WHAT" = "login" ]; then
  ask_token
  [ -z "$REPLY_TOK" ] && { echo "Nothing entered — not saved." >&2; exit 1; }
  mkdir -p "$(dirname "$TOKEN_FILE")"
  ( umask 077; printf 'CF_TOKEN=%s\n' "$REPLY_TOK" > "$TOKEN_FILE" )
  chmod 600 "$TOKEN_FILE"
  echo "Saved to $TOKEN_FILE (readable only by you)."
  echo "It is outside the repo, so it can never be committed or served."
  echo "Now just run:  ./backend/events/query.sh people"
  exit 0
fi

if [ -z "${CF_TOKEN:-}" ] && [ -r "$TOKEN_FILE" ]; then
  # shellcheck disable=SC1090
  CF_TOKEN="$(sed -n 's/^CF_TOKEN=//p' "$TOKEN_FILE" | head -1)"
fi
if [ -z "${CF_TOKEN:-}" ]; then
  ask_token; CF_TOKEN="$REPLY_TOK"
  echo "Tip: run './backend/events/query.sh login' once and it will stop asking." >&2
fi
[ -z "$CF_TOKEN" ] && { echo "No token given — nothing to query with." >&2; exit 1; }

case "$WHAT" in
  events)    SQL="SELECT blob1 AS event, sum(_sample_interval) AS n
                 FROM $DATASET WHERE timestamp > now() - INTERVAL '7' DAY
                 GROUP BY event ORDER BY n DESC" ;;
  # blob12 is 'installed', set from display-mode:standalone. yes = the Play app
  # OR a home-screen PWA; no = a browser tab. Only Play Console separates those.
  people)    SQL="SELECT blob12 AS installed, sum(_sample_interval) AS opens
                 FROM $DATASET WHERE blob1 = 'app_open'
                   AND timestamp > now() - INTERVAL '30' DAY
                 GROUP BY installed ORDER BY opens DESC" ;;
  funnel)    SQL="SELECT blob1 AS event, sum(_sample_interval) AS n
                 FROM $DATASET
                 WHERE timestamp > now() - INTERVAL '30' DAY
                   AND blob1 IN ('app_open','onboarding_complete','practice_day')
                 GROUP BY event" ;;
  weeks)     SQL="SELECT blob4 AS week, sum(_sample_interval) AS sessions
                 FROM $DATASET WHERE blob1 = 'session_complete'
                   AND timestamp > now() - INTERVAL '90' DAY
                 GROUP BY week ORDER BY week" ;;
  stage)     SQL="SELECT blob14 AS stage, sum(_sample_interval) AS opens
                 FROM $DATASET WHERE blob1 = 'app_open'
                   AND timestamp > now() - INTERVAL '30' DAY
                 GROUP BY stage ORDER BY stage" ;;
  countries) SQL="SELECT blob2 AS country, sum(_sample_interval) AS n
                 FROM $DATASET WHERE blob1 = 'app_open'
                   AND timestamp > now() - INTERVAL '30' DAY
                 GROUP BY country ORDER BY n DESC LIMIT 20" ;;
  raw)       SQL="${2:-}"; [ -z "$SQL" ] && { echo "raw needs a SQL string." >&2; exit 1; } ;;
  dashboard) SQL="" ;;   # handled below — it runs several queries, not one
  *)         echo "Don't know '$WHAT'." >&2; usage 1 ;;
esac

# One place that talks to Cloudflare. Prints the raw reply; callers decide.
cf(){ curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/analytics_engine/sql" \
        -H "Authorization: Bearer $CF_TOKEN" --data "$1"; }

if [ "$WHAT" = "dashboard" ]; then
  HISTORY="${CF_HISTORY_FILE:-$HOME/.config/be-mastery/history.json}"
  OUT="${DASHBOARD_OUT:-$(cd "$(dirname "$0")" && pwd)/dashboard.html}"
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

  # The all-time ledger asks only for what happened since the last run, so the
  # running total survives the dataset's rolling window. First run has no mark
  # and sweeps the whole window instead.
  SINCE_UNIX="$(python3 - "$HISTORY" <<'PY'
import json,sys,os,datetime
p=sys.argv[1]; last=None
if os.path.exists(p):
    try: last=json.load(open(p,encoding="utf-8")).get("last_snapshot")
    except Exception: pass
if last:
    try:
        print(int(datetime.datetime.fromisoformat(last).timestamp())); raise SystemExit
    except SystemExit: raise
    except Exception: pass
print(int((datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=90)).timestamp()))
PY
)"

  run(){ # run <key> <sql>  -> $TMP/<key>.json holding {"rows":[…]} or {"error":"…"}
    local key="$1" sql="$2" resp
    resp="$(cf "$sql" 2>&1 || true)"
    printf '%s' "$resp" | python3 -c '
import json,sys
raw=sys.stdin.read()
try: d=json.loads(raw)
except Exception: print(json.dumps({"error":"unreadable reply: "+raw[:160]})); raise SystemExit
if isinstance(d,dict) and d.get("success") is False:
    msg="; ".join(str(e.get("message")) for e in (d.get("errors") or [])) or "refused"
    print(json.dumps({"error":msg})); raise SystemExit
print(json.dumps({"rows": d.get("data") or [] if isinstance(d,dict) else []}))
' > "$TMP/$key.json"
  }

  echo "Querying…" >&2
  run since     "SELECT blob1 AS event, sum(_sample_interval) AS n FROM $DATASET
                 WHERE timestamp > toDateTime($SINCE_UNIX) GROUP BY event"
  run events    "SELECT blob1 AS event, sum(_sample_interval) AS n FROM $DATASET
                 WHERE timestamp > now() - INTERVAL '7' DAY GROUP BY event ORDER BY n DESC"
  run people    "SELECT blob12 AS installed, sum(_sample_interval) AS opens FROM $DATASET
                 WHERE blob1 = 'app_open' AND timestamp > now() - INTERVAL '30' DAY
                 GROUP BY installed"
  run funnel    "SELECT blob1 AS event, sum(_sample_interval) AS n FROM $DATASET
                 WHERE timestamp > now() - INTERVAL '30' DAY
                   AND blob1 IN ('app_open','onboarding_complete','practice_day')
                 GROUP BY event"
  run weeks     "SELECT blob4 AS week, sum(_sample_interval) AS sessions FROM $DATASET
                 WHERE blob1 = 'session_complete' AND timestamp > now() - INTERVAL '90' DAY
                 GROUP BY week ORDER BY week"
  run stage     "SELECT blob14 AS stage, sum(_sample_interval) AS opens FROM $DATASET
                 WHERE blob1 = 'app_open' AND timestamp > now() - INTERVAL '30' DAY
                 GROUP BY stage"
  run countries "SELECT blob2 AS country, sum(_sample_interval) AS n FROM $DATASET
                 WHERE blob1 = 'app_open' AND timestamp > now() - INTERVAL '30' DAY
                 GROUP BY country ORDER BY n DESC LIMIT 20"

  python3 -c '
import json,sys,os
d={}
for k in ["since","events","people","funnel","weeks","stage","countries"]:
    with open(os.path.join(sys.argv[1],k+".json"),encoding="utf-8") as f: d[k]=json.load(f)
json.dump(d,open(sys.argv[2],"w",encoding="utf-8"))
' "$TMP" "$TMP/bundle.json"

  python3 "$(cd "$(dirname "$0")" && pwd)/dashboard.py" "$TMP/bundle.json" "$HISTORY" "$OUT"
  echo "Wrote $OUT"
  command -v open >/dev/null && open "$OUT" || echo "Open it in your browser."
  exit 0
fi

RESP="$(curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT/analytics_engine/sql" \
         -H "Authorization: Bearer $CF_TOKEN" --data "$SQL")"

# The SQL API answers with bare JSON on success and a Cloudflare error envelope
# on failure, so tell the two apart before trying to print rows — otherwise a
# bad token reads as "no data", which is the one wrong answer to give here.
python3 - "$RESP" <<'PY'
import json, sys
raw = sys.argv[1]
try:
    d = json.loads(raw)
except Exception:
    print("Unreadable reply from Cloudflare:\n" + raw[:500]); sys.exit(1)

if isinstance(d, dict) and d.get("success") is False:
    for e in d.get("errors") or [{"message": "unknown error"}]:
        print("Cloudflare refused the query: %s (code %s)" % (e.get("message"), e.get("code")))
    print("\nUsually the token is missing the Account Analytics: Read permission.")
    sys.exit(1)

rows = d.get("data") if isinstance(d, dict) else None
if not rows:
    print("No rows yet.")
    print("That is normal until real traffic arrives — the dataset only holds")
    print("events recorded AFTER the Worker went live. It cannot backfill.")
    sys.exit(0)

cols = list(rows[0].keys())
w = [max(len(c), max(len(str(r.get(c, ""))) for r in rows)) for c in cols]
print("  ".join(c.ljust(w[i]) for i, c in enumerate(cols)))
print("  ".join("-" * x for x in w))
for r in rows:
    print("  ".join(str(r.get(c, "")).ljust(w[i]) for i, c in enumerate(cols)))
print("\n%d row(s). These are EVENT COUNTS, not people — there is no device ID" % len(rows))
print("in this dataset by design. Use Play Console for a real head-count.")
PY
