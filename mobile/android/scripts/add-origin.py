"""One-off (8 Oct 2026): allow the Android shell's origin (https://localhost) everywhere
the iOS shell's (capacitor://localhost) is allowed. Each replacement must match exactly once."""
import pathlib, sys
B = pathlib.Path(__file__).resolve().parents[3] / "backend"
EDITS = [
    ("widget/widget-worker.js",
     '"capacitor://localhost"];',
     '"capacitor://localhost", "https://localhost"];   // https://localhost = the Android shell (mobile/android)'),
    ("polish-worker.js",
     '  "capacitor://localhost",   // the App Store build (mobile/ios): WKWebView cannot use https for a local bundle\n',
     '  "capacitor://localhost",   // the App Store build (mobile/ios): WKWebView cannot use https for a local bundle\n  "https://localhost",       // the Play build as a native shell (mobile/android, androidScheme https)\n'),
    ("mail/mail-worker.js",
     '  "capacitor://localhost",   // the App Store build (mobile/ios): WKWebView cannot use https for a local bundle\n',
     '  "capacitor://localhost",   // the App Store build (mobile/ios): WKWebView cannot use https for a local bundle\n  "https://localhost",       // the Play build as a native shell (mobile/android, androidScheme https)\n'),
    ("partner/wrangler.toml",
     'ALLOWED_ORIGINS = "https://app.lomonec.com,https://salomon1010.github.io,capacitor://localhost"   # capacitor://localhost = the App Store build',
     'ALLOWED_ORIGINS = "https://app.lomonec.com,https://salomon1010.github.io,capacitor://localhost,https://localhost"   # capacitor://localhost = the App Store build; https://localhost = the Android shell'),
    ("partner/wrangler.toml",
     'ALLOWED_ORIGINS = "https://staging.lomonec.com,http://localhost:8000,http://127.0.0.1:8000,capacitor://localhost"',
     'ALLOWED_ORIGINS = "https://staging.lomonec.com,http://localhost:8000,http://127.0.0.1:8000,capacitor://localhost,https://localhost"'),
    ("entitlements/wrangler.toml",
     'ALLOWED_ORIGINS = "https://app.lomonec.com,capacitor://localhost"\n',
     'ALLOWED_ORIGINS = "https://app.lomonec.com,capacitor://localhost,https://localhost"   # https://localhost = the Android shell\n'),
    ("entitlements/wrangler.toml",
     'ALLOWED_ORIGINS = "https://staging.lomonec.com,capacitor://localhost"   # capacitor://localhost = a staging TestFlight build',
     'ALLOWED_ORIGINS = "https://staging.lomonec.com,capacitor://localhost,https://localhost"   # capacitor://localhost = a staging TestFlight build; https://localhost = a staging Android build'),
    ("entitlements/entitlements-worker.js",
     'const ORIGINS_DEFAULT = ["https://app.lomonec.com", "capacitor://localhost"];',
     'const ORIGINS_DEFAULT = ["https://app.lomonec.com", "capacitor://localhost", "https://localhost"];'),
    ("push/push-worker.js",
     '  "capacitor://localhost",          // the App Store shell\'s own origin (iOS notifications, 4 Oct 2026)\n',
     '  "capacitor://localhost",          // the App Store shell\'s own origin (iOS notifications, 4 Oct 2026)\n  "https://localhost",              // the Play build as a native shell (mobile/android)\n'),
    ("events/events-worker.js",
     '  "capacitor://localhost",   // the App Store build (mobile/ios)\n',
     '  "capacitor://localhost",   // the App Store build (mobile/ios)\n  "https://localhost",       // the Play build as a native shell (mobile/android)\n'),
]
for rel, old, new in EDITS:
    p = B / rel; s = p.read_text()
    if "https://localhost" in s and new in s: print("already", rel); continue
    n = s.count(old)
    if n != 1: sys.exit(f"{rel}: expected 1 match, found {n}")
    p.write_text(s.replace(old, new)); print("ok", rel)
