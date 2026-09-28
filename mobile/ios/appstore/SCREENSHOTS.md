# App Store screenshots — replacement plan for version 1.1.0

**Status (29 Sep 2026): the nine files in `screenshots/iphone-6.9/` are stale and must
not be uploaded.** They were taken on 20 Sep 2026: every one shows the old header with
the 🔥 streak pill (since removed), and none shows Home V2, which is the iPhone app's
Home in 1.1.0. Nothing below has been shot yet.

Size: 6.9" iPhone, **1320×2868**; 3–10 images. Neutral "Alex" profile, no real names.
**Rules:** no third-party YouTube artwork (thumbnails, video frames, channel avatars) —
owner rule since Aug 2026; no Premium badge, price or subscription wording (Premium is
not active); nothing the build does not do.

Tooling: `scripts/store-art/shoot.js iphone` renders the real app locally, but it has
**no iOS mode** (it cannot show the iPhone app's Home V2 default or hide web-only rows)
and Home V2's hero shows YouTube thumbnails. Either extend the rig with an iOS-shell
stub (`window.Capacitor.getPlatform()==="ios"`) and a hero slide whose picture is the
app's own (`home-photos/`), or capture on the iPhone with the demo profile.

| # | Current file — what is wrong | Replace with | Flow it shows | Home V2? | Live calls? | Premium risk |
|---|---|---|---|---|---|---|
| 1 | `01-dashboard` — classic Home, removed "Your daily mission" card, old header | **Home V2** (General English): the hero with the next step, the "Because you…" rows, Explore | "open the app → see today's next step" | **yes** | no | the header must show no Premium badge (true in the production build); **hero must not show a YouTube thumbnail** |
| 2 | `02-journey` — old header | **Road map** tab: the 12-week board with the lit stretch | the programme and where you are | no | no | none |
| 3 | `03-phrases` — old header and layout | **Phrase Lab → Executive Polish** with a sentence and its two rewrites | turning a casual sentence into a professional one (AI) | no | no | none |
| 4 | `04-progress` — Progress before "essentials first" (v487) | **Progress**: this week, the four numbers, the month, the certificate | tracking the habit | no | no | none |
| 5 | `05-session` — session before the 4-step day (v478) | **Daily session**: the task, the recorder, the speaking report card | record → hear it back → report | no | no | none |
| 6 | `06-practice` — old Practice layout, streak pill | **Practice** tab as it is now (Shadowing Studio, Phrase Lab, drills, Practice Partner, Practise a real conversation) | where the practice tools are | no | no | none |
| 7 | `07-trend` — the trend chart now sits behind a fold | **AI speaking report** ("How you came across", one fold open) from a real recording of the demo profile | the AI feedback a learner gets — strongest evidence for Guideline 4.2 | no | no | none |
| 8 | `08-partner` — old Practice Partner page; its "How it works" text said live calls were "nothing recorded" (no longer the app's wording) | **Practice Partner** page now: Practise / History tabs, *How it works* open (current text: "only your own voice is recorded, for your report") | finding a partner safely: consent, first names only, report/block | no (Practice Partner page) | shows the live option | none |
| 9 | `09-partner-match` — old candidate card | **Candidate card** after *Match me →* with *Try a practice →* and *Practise live*, and the AI coach offer | a real learner or the AI coach — always labelled AI | no | **yes** (the *Practise live* button) | none |

Shadow Studio stays **out** (every studio screen shows a YouTube video — third-party
artwork), as before. If a Shadow screenshot is ever wanted, only a screen with no video
frame and no thumbnail qualifies.

Order for upload: 1, 5, 7, 2, 8, 9, 3, 4, 6 (value first). Check each against
`METADATA.md` before uploading.
