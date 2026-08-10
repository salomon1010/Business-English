#!/usr/bin/env python3
"""Inline every asset into a flyer source, ready to render.

render-flyer.js does the same substitution but needs playwright-core, which is
not a project dependency. This writes a self-contained HTML next to the source
so the page can be rendered by any browser — including one driven over CDP —
and still reproduces from a clean checkout.

  python3 marketing/build-flyers.py            # both
  python3 marketing/build-flyers.py welding    # one

Output: marketing/build/<name>.html (git-ignored working files, not artwork).
"""
import base64, mimetypes, os, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent
OUT = HERE / "build"

def uri(path):
    p = pathlib.Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "application/octet-stream"
    if p.suffix == ".svg":
        mime = "image/svg+xml"
    return "data:%s;base64,%s" % (mime, base64.b64encode(p.read_bytes()).decode())

SHOTS = REPO / "playstore/store-art-2026-08/phone"
WELD = HERE / "shots-welding"
GEN  = HERE / "shots-general"
CAR  = HERE / "shots-career"

FLYERS = {
    # the general-English poster: the store-art phone captures it has always used
    "whatsapp-flyer": {
        "src": HERE / "whatsapp-flyer.src.html",
        # captured from the current build rather than the Play store-art set, so
        # the poster shows the app as it looks today
        "tokens": {
            "__LOGO__":  REPO / "logo.svg",
            "__SHOT1__": GEN / "g1-dashboard.png",
            "__SHOT3__": GEN / "g2-calendar.png",
            "__SHOT4__": GEN / "g3-progress.png",
            "__QR__":    HERE / "qr-applomonec.png",
        },
    },
    # the welding poster: captured from the professional track itself
    "welding-flyer": {
        "src": HERE / "welding-flyer.src.html",
        "tokens": {
            "__LOGO__":            REPO / "logo.svg",
            "__SHOT_COACHES__":    WELD / "w2-coaches.png",
            "__SHOT_REPORT__":     WELD / "w3-report.png",
            "__SHOT_SCENARIOS__":  WELD / "w4-scenarios.png",
            "__QR__":              HERE / "qr-applomonec.png",
        },
    },
    # the career poster: the four Career Center / Passport features, captured by
    # scripts/store-art/shoot-career.js
    "career-flyer": {
        "src": HERE / "career-flyer.src.html",
        "tokens": {
            "__LOGO__":          REPO / "logo.svg",
            "__SHOT_CAREER__":   CAR / "c0-readiness.png",
            "__SHOT_REPORT__":   CAR / "c5-report.png",
            "__SHOT_EVIDENCE__": CAR / "c1-evidence.png",
            "__QR__":            HERE / "qr-applomonec.png",
        },
    },
}

want = sys.argv[1:] or list(FLYERS)
OUT.mkdir(exist_ok=True)
for name in want:
    key = name if name in FLYERS else name + "-flyer"
    if key not in FLYERS:
        raise SystemExit("unknown flyer: %s (have %s)" % (name, ", ".join(FLYERS)))
    spec = FLYERS[key]
    html = spec["src"].read_text()
    for token, path in spec["tokens"].items():
        if token not in html:
            raise SystemExit("%s: token %s not in source" % (key, token))
        if not pathlib.Path(path).exists():
            raise SystemExit("%s: missing asset %s" % (key, path))
        html = html.replace(token, uri(path))
    left = [t for t in ("__LOGO__", "__QR__") if t in html]
    if left:
        raise SystemExit("%s: unsubstituted %s" % (key, left))
    dest = OUT / (key + ".html")
    dest.write_text(html)
    print("%-16s -> %s  (%.1f MB)" % (key, dest.relative_to(REPO), dest.stat().st_size / 1e6))
