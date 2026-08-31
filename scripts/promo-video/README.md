# Promo video recorder

Records the app itself, screen by screen, as 9:16 clips for TikTok, Reels,
Shorts, Facebook and YouTube. No camera, no voice-over — the product
demonstrates itself, and a caption is drawn into the page so the clip reads with
the sound off (which is how nearly all of it is watched).

    cd <repo root>
    python3 -m http.server 8011 &                 # any free port
    node scripts/promo-video/record.mjs /tmp/vid  # ~90s, writes one .webm per scene

Then convert to MP4 (TikTok will not reliably take WebM):

    FF=/Applications/BlueStacks.app/Contents/MacOS/ffmpeg   # or: brew install ffmpeg
    for d in /tmp/vid/*/; do
      id=$(basename "$d"); src=$(find "$d" -name '*.webm' | head -1)
      "$FF" -y -i "$src" -vf "scale=1080:1920:flags=lanczos" \
        -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -r 30 \
        -movflags +faststart "marketing/video/$id.mp4"
    done

## Things that will bite you if you change this

- **Port.** 8000 is often taken by another project. A wrong port records someone
  else's site and the failure looks like "the app didn't load".
- **`channel: "chromium"`.** The headless shell cannot record video. Without the
  channel you get an empty file.
- **`recordVideo.size` must equal the viewport.** Playwright letterboxes rather
  than scales — asking for 1080x1920 against a 540x960 viewport puts the app in
  the top-left corner of a grey frame. Record at viewport size, upscale in ffmpeg.
- **`be12_syncNudge` must be set to "1".** Otherwise the "Save your progress"
  banner slides in mid-shot and covers the content.
- **The caption is injected into the page**, not burned by ffmpeg, because the
  bundled ffmpeg builds here have no `drawtext` filter. It also means the caption
  uses the app's own font.

## The seed

`seed.mjs` is demo state — a neutral "Alex" profile with realistic progress, the
same technique the Play Store screenshot rig uses. It exists so the screens are
populated rather than empty. It is not a real user's data and nothing in it is
presented as one.
