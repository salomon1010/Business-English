# App Store screenshots — plan and status

Size: 6.9" iPhone, **1320×2868** (the one size App Store Connect requires
today; it scales the rest). Source of every image: the real app rendered by
`scripts/store-art/shoot.js iphone` (Playwright + Chrome, the app in a phone-
width iframe scaled ×3), seeded with the neutral "Alex" profile. No mock-ups,
no composited screens, no third-party artwork.

| # | Screen | Status | Note |
|---|---|---|---|
| 1 | Learn English — dashboard | ✅ `01-dashboard.png` | Home with today's session |
| 2 | Road map | ✅ `02-journey.png` | 12-week board |
| 3 | Phrase Lab / Executive Polish | ✅ `03-phrases.png` | |
| 4 | Progress calendar | ✅ `04-progress.png` | |
| 5 | Daily practice — session | ✅ `05-session.png` | recorder + task |
| 6 | Practice tab — tools incl. Practice Partner card | ✅ `06-practice.png` | re-shot on the release build (Practice Partner card with live counts, Shadowing Studio entry) |
| 7 | Progress trend | ✅ `07-trend.png` | |
| 8 | Practice Partner — find a partner (presence strip, Match me) | ✅ `08-partner.png` | `PARTNER=1` scene; real UI against a local be-partner Worker with a second learner in line |
| 9 | Human practice — candidate card | ✅ `09-partner-match.png` | same run, after *Match me* ("Sam · Weeks 1–4 · Why: same level + same lesson", Practise live / Try a practice) |
| — | Shadow Studio / Challenge | ❌ deliberately absent | every dense studio screen renders a third-party YouTube video or thumbnail (someone else's likeness and copyright in store marketing) — owner decision of 2026-08, unchanged |
| — | AI feedback card | ❌ not captured | needs a live be-polish call with a real recording; capture by hand on the device if wanted (Settings → Developer → screenshot), or leave out |

Regenerate:
```
python3 -m http.server 8765                                  # repo root
cd backend/partner && npx wrangler dev --env dev --port 8790 # for shots 8–9 only
PARTNER=1 PARTNER_API=http://127.0.0.1:8790 OUT_ROOT=ios-shots node scripts/store-art/shoot.js iphone
cp playstore/ios-shots/iphone-6.9/*.png mobile/ios/appstore/screenshots/iphone-6.9/ && rm -r playstore/ios-shots
```
The rig seeds the placement as done and the one-time nudges as seen, hides
transient toasts before each capture, and resets nothing outside the local
Worker you point it at (`POST /__reset` on that dev instance first gives a
clean line: only "Sam").

All nine were re-taken on 2026-09-20 from the release branch and checked by eye.
App Store Connect accepts 3–10 per size; upload in the order above.
