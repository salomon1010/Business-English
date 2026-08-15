#!/usr/bin/env python3
# ============================================================================
# BE Mastery — build the local product-events dashboard.
#
# Called by query.sh, which does the querying (it holds the token) and hands
# this script a JSON bundle of results. This script owns two things:
#
#   1. the ALL-TIME ledger. Analytics Engine keeps a rolling window (~90 days),
#      so a query can never answer "how many since launch". Each run asks only
#      for events since the previous run and ADDS them to a running total kept
#      in ~/.config/be-mastery/history.json. That stays correct for as long as
#      runs are more frequent than the retention window; miss a quarter and the
#      gap is real and unrecoverable, so the page says when it last ran.
#
#   2. the HTML. Self-contained, no network, no build step — open it and read.
#
# Colours are the validated data-viz palette: categorical slots 1-2 for the one
# two-identity chart, a single-hue ordinal ramp for ordered stages, both checked
# with the palette validator in light AND dark against the real surfaces.
# ============================================================================
import json, os, sys, html, datetime

BUNDLE, HISTORY, OUT = sys.argv[1], sys.argv[2], sys.argv[3]

with open(BUNDLE, encoding="utf-8") as f:
    B = json.load(f)

def rows(key):
    """Query results, or [] — a failed query is not the same as no data, and
       panels render the difference rather than showing a confident zero."""
    r = B.get(key) or {}
    return r.get("rows") or []

def failed(key):
    r = B.get(key) or {}
    return r.get("error")

def n(v):
    try: return int(float(v))
    except Exception: return 0

# ---- the all-time ledger --------------------------------------------------
hist = {"totals": {}, "last_snapshot": None, "runs": []}
if os.path.exists(HISTORY):
    try:
        with open(HISTORY, encoding="utf-8") as f: hist = json.load(f)
    except Exception: pass
hist.setdefault("totals", {}); hist.setdefault("runs", [])

added = {}
if not failed("since"):
    for r in rows("since"):
        ev, c = r.get("event"), n(r.get("n"))
        if ev and c: added[ev] = added.get(ev, 0) + c
    for ev, c in added.items():
        hist["totals"][ev] = hist["totals"].get(ev, 0) + c
    now = datetime.datetime.now(datetime.timezone.utc)
    hist["last_snapshot"] = now.isoformat(timespec="seconds")
    hist["runs"].append({"at": hist["last_snapshot"], "added": added})
    hist["runs"] = hist["runs"][-500:]
    os.makedirs(os.path.dirname(HISTORY), exist_ok=True)
    tmp = HISTORY + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: json.dump(hist, f, indent=1)
    os.replace(tmp, HISTORY)          # atomic: a crash mid-write must not eat the ledger

TOT = hist["totals"]
# Cumulative curve from the run log — the only record that outlives retention.
cum, run_pts = 0, []
for r in hist["runs"]:
    cum += sum(r.get("added", {}).values())
    run_pts.append((r["at"][:10], cum))

E = html.escape

# ---- marks ----------------------------------------------------------------
def hbars(data, colors, unit=""):
    """Horizontal bars. Every bar is directly labelled, so identity never rests
       on colour alone and the chart doubles as its own table."""
    if not data: return empty()
    mx = max(v for _, v in data) or 1
    out = ['<div class="bars">']
    for i, (label, v) in enumerate(data):
        # Clamp, never wrap: wrapping an ordinal ramp sends the last bar back to
        # the lightest step and destroys the light-to-dark reading that is the
        # only reason the ramp is there.
        c = colors[min(i, len(colors) - 1)] if isinstance(colors, list) else colors
        w = max(0.6, v / mx * 100)
        out.append(
            f'<div class="bar-row" title="{E(str(label))}: {v}{E(unit)}">'
            f'<span class="bar-lbl">{E(str(label))}</span>'
            f'<span class="bar-track"><i style="width:{w:.1f}%;background:{c}"></i></span>'
            f'<b class="bar-val">{v}{E(unit)}</b></div>')
    out.append("</div>")
    return "".join(out)

def vbars(data):
    if not data: return empty()
    mx = max(v for _, v in data) or 1
    cells = "".join(
        f'<div class="vb" title="{E(str(l))}: {v}">'
        f'<b>{v}</b><i style="height:{max(2, v/mx*100):.1f}%"></i>'
        f'<span>{E(str(l))}</span></div>' for l, v in data)
    return f'<div class="vbars">{cells}</div>'

def sparkline(points):
    """Cumulative all-time total. One series, so no legend — the title names it.
       Needs two runs before a line means anything; says so until then."""
    if len(points) < 2:
        return ('<p class="empty">The all-time line needs at least two runs to draw. '
                'Run this again in a few days and it starts building.</p>')
    W, H, P = 560, 120, 8
    vals = [v for _, v in points]
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1
    n_ = len(points)
    xs = [P + i / (n_ - 1) * (W - 2 * P) for i in range(n_)]
    ys = [H - P - (v - lo) / span * (H - 2 * P) for v in vals]
    line = " ".join(("M" if i == 0 else "L") + f"{xs[i]:.1f},{ys[i]:.1f}" for i in range(n_))
    area = line + f" L{xs[-1]:.1f},{H-P} L{xs[0]:.1f},{H-P} Z"
    dots = "".join(
        f'<circle cx="{xs[i]:.1f}" cy="{ys[i]:.1f}" r="4" fill="var(--series-1)" '
        f'stroke="var(--surface-1)" stroke-width="2"><title>{E(points[i][0])}: {vals[i]}</title></circle>'
        for i in range(n_))
    return (f'<svg viewBox="0 0 {W} {H}" class="spark" role="img" '
            f'aria-label="Cumulative events, {vals[0]} to {vals[-1]}">'
            f'<path d="{area}" fill="var(--series-1)" opacity=".14"/>'
            f'<path d="{line}" fill="none" stroke="var(--series-1)" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round"/>{dots}</svg>'
            f'<p class="cap">{E(points[0][0])} → {E(points[-1][0])} · '
            f'{vals[-1]} events counted since this dashboard started keeping score</p>')

def empty(msg="Nothing recorded here yet."):
    return f'<p class="empty">{E(msg)}</p>'

def panel(title, body, note="", key=None):
    if key and failed(key):
        body = (f'<p class="err">This query failed, so the panel below is blank for a '
                f'reason that is not "no data": {E(str(failed(key)))}</p>')
    return (f'<section class="card"><h2>{E(title)}</h2>'
            f'{f"<p class=sub>{E(note)}</p>" if note else ""}{body}</section>')

# ---- panels ---------------------------------------------------------------
SER1, SER2 = "var(--series-1)", "var(--series-2)"
# Exactly three steps, validated as an ordinal ramp in both modes. Used ONLY for
# the funnel, which has exactly three stages. The blue range cannot hold five
# distinguishable steps (adjacent ΔL 0.047 against a 0.06 floor), so anything
# longer than this gets a single hue and lets row order carry the sequence.
ORD = ["var(--ord-1)", "var(--ord-2)", "var(--ord-3)"]

installed = {str(r.get("installed")): n(r.get("opens")) for r in rows("people")}
inst_data = [("Installed app", installed.get("yes", 0)), ("Web browser", installed.get("no", 0))]

fun = {str(r.get("event")): n(r.get("n")) for r in rows("funnel")}
FUNNEL = [("Opened the app", fun.get("app_open", 0)),
          ("Finished onboarding", fun.get("onboarding_complete", 0)),
          ("Practised", fun.get("practice_day", 0))]

weeks = sorted([(str(r.get("week") or "?"), n(r.get("sessions"))) for r in rows("weeks")],
               key=lambda x: (len(x[0]), x[0]))
stage = [(str(r.get("stage") or "?"), n(r.get("opens"))) for r in rows("stage")]
STAGE_ORDER = {"0": 0, "1-6": 1, "7-27": 2, "28-83": 3, "84+": 4}
stage.sort(key=lambda x: STAGE_ORDER.get(x[0], 9))
countries = [(str(r.get("country") or "??"), n(r.get("n"))) for r in rows("countries")][:12]
ev7 = [(str(r.get("event")), n(r.get("n"))) for r in rows("events")]

opens30 = fun.get("app_open", 0)
alltime = sum(TOT.values())
last = hist.get("last_snapshot") or "never"

tiles = "".join(
    f'<div class="tile"><b>{v}</b><span>{E(l)}</span></div>' for l, v in [
        ("Opens, last 30 days", opens30),
        ("Installed app / web", f'{installed.get("yes",0)} / {installed.get("no",0)}'),
        ("Sessions completed, all time", TOT.get("session_complete", 0)),
        ("Events counted, all time", alltime),
    ])

body = f"""
<header class="page-head">
  <h1>BE Mastery · product events</h1>
  <p class="sub">Built {E(datetime.datetime.now().strftime('%d %b %Y, %H:%M'))} ·
     ledger last updated {E(str(last)[:16].replace('T',' '))}</p>
</header>

<div class="tiles">{tiles}</div>

<p class="warn"><b>These are event counts, not people.</b> Nothing in this dataset
carries a device ID, by design, so one person opening the app forty times and forty
people opening it once look identical here. Trends and ratios are trustworthy;
head-counts are not — for those use Play Console and the Firestore account list.</p>

{panel("Where people stop", vbars(weeks),
       "Sessions completed per programme week, last 90 days. A cliff between two "
       "adjacent weeks is the most actionable number on this page.", "weeks")}

{panel("Do they get started?", hbars(FUNNEL, ORD),
       "Last 30 days. A drop at step 2 is an onboarding problem; a drop at step 3 "
       "is a first-session problem. Different fixes.", "funnel")}

{panel("Installed app or the open web", hbars(inst_data, [SER1, SER2]),
       "Opens in the last 30 days. “Installed” means the Play app or a "
       "home-screen PWA — it cannot tell those two apart; only Play Console can.",
       "people")}

{panel("How far along people are", hbars(stage, SER1),
       "Sessions already completed by whoever opened the app, last 30 days.", "stage")}

{panel("Cumulative, all time", sparkline(run_pts),
       "Analytics Engine only keeps a rolling window, so this line is built from a "
       "running total this dashboard keeps itself. Run it regularly and it stays "
       "honest; leave it for months and the gap is real.")}

{panel("Where they are", hbars(countries, SER1),
       "Opens by country, last 30 days. The queue for which language to review next.",
       "countries")}

{panel("Everything that fired", hbars(ev7, SER1), "Last 7 days.", "events")}

<details class="tablewrap"><summary>Show the raw numbers as a table</summary>
  <table><thead><tr><th>Event</th><th>All time</th></tr></thead><tbody>
  {''.join(f'<tr><td>{E(k)}</td><td>{v}</td></tr>' for k, v in sorted(TOT.items(), key=lambda x: -x[1])) or '<tr><td colspan=2>Nothing yet.</td></tr>'}
  </tbody></table>
</details>

<p class="foot">Rebuild with <code>./backend/events/query.sh dashboard</code>.
This file is generated — it is not committed, because this repo is served publicly.</p>
"""

CSS = """
:root{color-scheme:light;
 --page:#f9f9f7; --surface-1:#fcfcfb; --text-primary:#0b0b0b; --text-secondary:#52514e;
 --muted:#898781; --grid:#e1e0d9; --axis:#c3c2b7;
 --series-1:#2a78d6; --series-2:#eb6834;
 --ord-1:#86b6ef; --ord-2:#5598e7; --ord-3:#2a78d6;
 --warn:#fab219; --crit:#d03b3b;}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){color-scheme:dark;
 --page:#0d0d0d; --surface-1:#1a1a19; --text-primary:#fff; --text-secondary:#c3c2b7;
 --muted:#898781; --grid:#2c2c2a; --axis:#383835;
 --series-1:#3987e5; --series-2:#d95926;
 --ord-1:#3987e5; --ord-2:#256abf; --ord-3:#184f95;}}
:root[data-theme="dark"]{color-scheme:dark;
 --page:#0d0d0d; --surface-1:#1a1a19; --text-primary:#fff; --text-secondary:#c3c2b7;
 --muted:#898781; --grid:#2c2c2a; --axis:#383835;
 --series-1:#3987e5; --series-2:#d95926;
 --ord-1:#3987e5; --ord-2:#256abf; --ord-3:#184f95;}
*{box-sizing:border-box}
body{margin:0;padding:28px 20px 60px;background:var(--page);color:var(--text-primary);
 font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}
.page-head,.tiles,.card,.warn,.tablewrap,.foot{max-width:820px;margin-left:auto;margin-right:auto}
h1{font-size:23px;margin:0 0 4px;letter-spacing:-.3px}
h2{font-size:15.5px;margin:0 0 3px}
.sub{margin:0 0 12px;font-size:12.5px;color:var(--text-secondary)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin:18px auto}
.tile{background:var(--surface-1);border:1px solid var(--grid);border-radius:12px;padding:14px 16px}
.tile b{display:block;font-size:26px;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:-.5px}
.tile span{font-size:12px;color:var(--text-secondary)}
.card{background:var(--surface-1);border:1px solid var(--grid);border-radius:14px;padding:16px 18px;margin:14px auto}
.warn{background:var(--surface-1);border:1px solid var(--grid);border-left:3px solid var(--warn);
 border-radius:10px;padding:11px 14px;font-size:12.5px;color:var(--text-secondary);margin:16px auto}
.warn b{color:var(--text-primary)}
.bars{display:flex;flex-direction:column;gap:7px;margin-top:10px}
.bar-row{display:grid;grid-template-columns:minmax(96px,34%) 1fr auto;gap:10px;align-items:center}
.bar-lbl{font-size:12.5px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{background:var(--grid);border-radius:4px;height:14px;overflow:hidden}
.bar-track i{display:block;height:100%;border-radius:4px}
.bar-val{font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;min-width:34px;text-align:right}
.vbars{display:flex;align-items:flex-end;gap:6px;height:170px;margin-top:12px;
 border-bottom:1px solid var(--axis);padding-bottom:2px}
.vb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}
.vb b{font-size:11.5px;font-variant-numeric:tabular-nums;margin-bottom:3px}
.vb i{display:block;width:100%;max-width:34px;background:var(--series-1);border-radius:4px 4px 0 0}
.vb span{font-size:10.5px;color:var(--muted);margin-top:5px}
.spark{width:100%;height:auto;display:block;margin-top:8px}
.cap,.empty,.err{font-size:12.5px;color:var(--text-secondary);margin:8px 0 0}
.empty{color:var(--muted)}
.err{color:var(--crit)}
.tablewrap{margin-top:20px;font-size:13px}
summary{cursor:pointer;color:var(--text-secondary)}
table{border-collapse:collapse;margin-top:10px;width:100%}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--grid);font-variant-numeric:tabular-nums}
.foot{margin-top:26px;font-size:12px;color:var(--muted)}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
"""

# OUT of "-" means ledger-only: the scheduled snapshot has no one to show a page
# to, and writing one would only leave a stale file that looks current.
if OUT == "-":
    print("added this run: %s" % (added or "nothing new"))
    print("all-time total: %d events across %d names" % (alltime, len(TOT)))
    raise SystemExit(0)

with open(OUT, "w", encoding="utf-8") as f:
    f.write("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            "<title>BE Mastery · product events</title>"
            f"<style>{CSS}</style></head><body>{body}</body></html>")

print("added this run: %s" % (added or "nothing new"))
print("all-time total: %d events across %d names" % (alltime, len(TOT)))
