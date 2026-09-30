# Third-party content in the Shadowing Studio — what it is, and the question it raises

Written for whoever answers App Store Connect's content-rights questions. This
is a factual description of what the code does. **It makes no legal judgement
and reaches no conclusion about rights** — that is the owner's call, with
counsel if wanted.

## Where third-party content is used

Only in the **Shadowing Studio**. Nothing else in the app plays third-party
media: the curriculum, sessions, Executive Polish, Practice Partner, interviews
and the Welding workshops are all the app's own material.

| | General English | Welding |
|---|---|---|
| Catalogue file | `catalogue/general.json` | `catalogue/welding.json` |
| Videos | 385 | see the file |
| Distinct channels | 19 | see `catalogue/welding-sources.json` |

Largest General English channels by count: Think Fast Talk Smart (34), FluentU
English (32), Speak Confident English (30), Harvard Business Review (30), Learn
English With TV Series (25).

Each catalogue entry stores the YouTube video id, the title, the **channel name
(`ch`) and channel id (`chId`)**, and the duration. Attribution travels with
every row.

## How it is embedded and streamed

1. **Playback — YouTube's own player.** The app loads
   `https://www.youtube.com/iframe_api` and creates a `YT.Player`. The video is
   streamed by YouTube inside YouTube's iframe, with YouTube's own controls and
   branding. **No video file is downloaded, copied, re-hosted or bundled**, and
   the repository contains no video media.
2. **Thumbnails — YouTube's CDN.** Rows and the hero load
   `https://i.ytimg.com/vi/<id>/mqdefault.jpg` (and `maxresdefault.jpg`)
   directly from YouTube. They are not copied into the app.
3. **Captions.** `captions/<id>.json` holds caption cues used for line-by-line
   shadowing. They are fetched through the app's own Worker
   (`fetchYouTubeCaptions` in `backend/polish-worker.js`) from YouTube's caption
   data for that video.
4. **Learner-supplied videos.** A learner may paste their own YouTube link; it
   plays the same way, through YouTube's player.
5. **"Find on YouTube"** opens `youtube.com/results?search_query=…` outside the
   app, in the browser.

The one piece of third-party material the repository **does** store is the
caption text in `captions/`. Everything else is streamed from YouTube at
playback time.

## What this affects in App Store Connect

- **App Review → "Does your app contain, show, or access third-party content?"**
  The answer is **yes**. It cannot be answered "no": the Shadowing Studio's
  whole purpose is practising against real recorded speech, and that speech is
  other people's, played through YouTube.
  App Review usually then asks for the rights or permissions relied on.
- **Content Rights information** — the same question in the listing metadata.
- **Age rating → "Unrestricted web access"**: currently answered **No** in
  `METADATA.md`, on the grounds that the app opens its own pages and a YouTube
  *search* leaves the app for Safari. Worth re-reading with the embedded player
  in mind, since the player is YouTube's surface inside the app.
- **Screenshots**: `playstore/` notes already record a deliberate decision not
  to ship a Shadow screenshot, because every dense Shadow screen renders
  third-party artwork or the embedded player. The App Store set follows the same
  rule — none of the nine 6.9" screenshots shows the Studio.

## What the owner has to decide

1. **What to tell App Review** when asked what permits the app to show this
   content. The factual position is: streamed through YouTube's official IFrame
   Player API, unmodified, with YouTube's controls and branding, channel
   attribution stored per video, nothing downloaded or re-hosted. Whether that
   is sufficient, and whether any channel needs to be approached directly, is
   the owner's decision.
2. **Whether the stored captions** in `captions/` change that answer, since they
   are the one third-party asset held in the repository rather than streamed.
3. **Whether to re-answer "unrestricted web access"** given the embedded player.

## What must not be done to make the question go away

Removing Shadow content to dodge the metadata question is explicitly **not** the
answer — the library is the feature. Nor may the listing claim the app owns this
material: it does not, and `METADATA.md` already says only the app's own
lessons, audio and pictures are Lomonec LLC's.
