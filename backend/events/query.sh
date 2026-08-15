#!/usr/bin/env bash
# ============================================================================
# BE Mastery — read the product-event numbers.
#
#   ./query.sh                 list the questions it can answer
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
# The token is a credential. This script reads it from $CF_TOKEN if it is set,
# and otherwise asks for it without echoing it to the screen. It never writes it
# to disk and it must never be committed — that is why there is no token file
# here and no default value below.
# ============================================================================
set -euo pipefail

ACCOUNT="${CF_ACCOUNT:-8d3cd584749c92c7076d30688dde2a1d}"
DATASET="be_events"

usage(){ sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

WHAT="${1:-}"
[ -z "$WHAT" ] && usage 0

if [ -z "${CF_TOKEN:-}" ]; then
  printf 'Cloudflare API token (input hidden): ' >&2
  read -rs CF_TOKEN < /dev/tty; echo >&2
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
  *)         echo "Don't know '$WHAT'." >&2; usage 1 ;;
esac

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
