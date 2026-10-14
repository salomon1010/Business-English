#!/usr/bin/env python3
"""Check the Welding branding, on both platforms, against the rules the stores
and the two-app split impose.

    python3 scripts/branding/verify-welding-icons.py

Every check prints its own measurement, so a failure says what was wrong rather
than only that something was. Exit status is non-zero if any check fails."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
AND = ROOT / "mobile/android/android/app/src/welding/res"
MAIN = ROOT / "mobile/android/android/app/src/main/res"
IOS = ROOT / "mobile/ios/ios/App/App/Assets.xcassets"

fails = []


def check(name, ok, detail):
    print(f"{'ok  ' if ok else 'FAIL'}  {name}: {detail}")
    if not ok:
        fails.append(name)


def img(p):
    return Image.open(p)


def signature(p, frame=1.0, inner=0.72):
    """What the mark looks like, at 48x48, with its framing taken out.

    `frame` is how much of the file the artwork itself occupies — a store icon
    is full-bleed, the adaptive foreground sits in the launcher's 72/108
    viewport, the splash is a small logo on a field. Taking `inner` of that
    again drops the edges, where the three framings legitimately differ."""
    im = Image.open(p).convert("RGB")
    s = min(im.size)
    cx, cy = im.width / 2, im.height / 2
    half = s * frame * inner / 2
    box = (round(cx - half), round(cy - half), round(cx + half), round(cy + half))
    return np.asarray(im.crop(box).resize((48, 48), Image.LANCZOS)).astype(float)


def differs(a, b, frame_a=1.0, frame_b=1.0):
    return float(np.abs(signature(a, frame_a) - signature(b, frame_b)).mean())


# ---------------------------------------------------------------- 1. presence
EXPECT = {
    AND / "mipmap-mdpi/ic_launcher.png": 48, AND / "mipmap-hdpi/ic_launcher.png": 72,
    AND / "mipmap-xhdpi/ic_launcher.png": 96, AND / "mipmap-xxhdpi/ic_launcher.png": 144,
    AND / "mipmap-xxxhdpi/ic_launcher.png": 192,
    AND / "mipmap-mdpi/ic_launcher_round.png": 48, AND / "mipmap-hdpi/ic_launcher_round.png": 72,
    AND / "mipmap-xhdpi/ic_launcher_round.png": 96, AND / "mipmap-xxhdpi/ic_launcher_round.png": 144,
    AND / "mipmap-xxxhdpi/ic_launcher_round.png": 192,
    AND / "mipmap-mdpi/ic_launcher_foreground.png": 108, AND / "mipmap-hdpi/ic_launcher_foreground.png": 162,
    AND / "mipmap-xhdpi/ic_launcher_foreground.png": 216, AND / "mipmap-xxhdpi/ic_launcher_foreground.png": 324,
    AND / "mipmap-xxxhdpi/ic_launcher_foreground.png": 432,
    IOS / "AppIconWelding.appiconset/AppIconWelding-1024.png": 1024,
    ROOT / "playstore/welding/play-icon-512.png": 512,
    ROOT / "branding/welding/icon-512.png": 512,
    ROOT / "branding/welding/icon-192.png": 192,
}
missing = [p for p in EXPECT if not p.exists()]
check("every asset is present", not missing,
      f"{len(EXPECT) - len(missing)}/{len(EXPECT)} files" + (f", missing {missing}" if missing else ""))
bad = {p: img(p).size for p, n in EXPECT.items() if p.exists() and img(p).size != (n, n)}
check("every asset is the size its slot wants", not bad, bad or f"{len(EXPECT)} sizes as declared")

# every density of the Android splash, in both orientations
splashes = sorted(AND.glob("drawable*/splash.png"))
check("the Welding flavour overrides every splash drawable", len(splashes) == 11,
      f"{len(splashes)} of 11 (default + 5 portrait + 5 landscape)")

# ------------------------------------------------- 2. what the stores require
for p in (IOS / "AppIconWelding.appiconset/AppIconWelding-1024.png", ROOT / "playstore/welding/play-icon-512.png"):
    im = img(p)
    alpha = "A" in im.mode
    # Apple rejects an app icon with an alpha channel outright; Play flattens it
    # onto white, which would put a white rim inside its own mask.
    check(f"{p.name} has no alpha channel", not alpha, f"mode {im.mode}")
    a = np.asarray(im.convert("RGB"))
    corners = [a[0, 0], a[0, -1], a[-1, 0], a[-1, -1]]
    flat = max(float(np.abs(c.astype(int) - a.reshape(-1, 3).mean(axis=0)).sum()) for c in corners)
    check(f"{p.name} is full-bleed, not a pre-rounded tile", flat > 30,
          "corners carry artwork, so neither store's mask can cut a dark crescent out of it")

# ------------------------------------------- 3. the adaptive icon's safe zone
fg = Image.open(AND / "mipmap-xxxhdpi/ic_launcher_foreground.png").convert("RGB")
S = fg.width
a = np.asarray(fg).astype(int)
navy = np.array([10, 14, 26])
ink = np.abs(a - navy).sum(axis=2) > 60          # anything that is not the pad
y, x = np.mgrid[0:S, 0:S]
c = (S - 1) / 2
viewport = ((x - c) ** 2 + (y - c) ** 2) <= (S * 72 / 108 / 2) ** 2   # the launcher's circular mask
safe = ((x - c) ** 2 + (y - c) ** 2) <= (S * 66 / 108 / 2) ** 2       # Google's inner safe zone
total = ink.sum()
check("the adaptive foreground fills the launcher's viewport", (ink & ~viewport).sum() / total > 0.02,
      f"{100 * (ink & ~viewport).sum() / total:.0f}% of the artwork lies outside the circular mask "
      "and is cropped by it — the icon reaches the edge rather than sitting as a tile on a border")

# What must survive every mask shape is the mark itself. The white speech
# bubble is the element the icon is read by, so it is the one measured; the
# ember sweep behind it is background and is MEANT to run off the edge, the way
# it does on the artwork as drawn.
white = (a[..., 0] > 215) & (a[..., 1] > 215) & (a[..., 2] > 215)
outside = (white & ~safe).sum() / max(1, white.sum())
check("the speech bubble is inside the 66dp safe zone", outside < 0.005,
      f"{(white & ~safe).sum()} of {white.sum()} of its pixels fall outside it")
ember = (a[..., 0] > 180) & (a[..., 1] > 70) & (a[..., 1] < 200) & (a[..., 2] < 110)
print(f"        for information: {100 * (ember & ~safe).sum() / max(1, ember.sum()):.0f}% of the ember "
      "sweep is outside the safe zone, which is the background running off the edge by design")

# ------------------------------------------- 4. one artwork, used everywhere
# (asset, how much of the file the artwork fills) — see make-welding-icons.py
same = [
    ("Android legacy launcher", AND / "mipmap-xxxhdpi/ic_launcher.png", 0.90),
    ("Android adaptive foreground", AND / "mipmap-xxxhdpi/ic_launcher_foreground.png", 72 / 108),
    ("Android splash", AND / "drawable-port-xxxhdpi/splash.png", 0.30),
    ("iOS app icon", IOS / "AppIconWelding.appiconset/AppIconWelding-1024.png", 1.0),
    ("iOS launch screen", IOS / "SplashWelding.imageset/splash-2732x2732.png", 0.22),
    ("Play listing icon", ROOT / "playstore/welding/play-icon-512.png", 1.0),
    ("in-app mark (bundle icon-512)", ROOT / "branding/welding/icon-512.png", 1.0),
]
ref = ROOT / "branding/welding/icon-1024.png"
worst = 0.0
for label, p, frame in same:
    if not p.exists():
        check(f"{label} exists", False, str(p))
        continue
    d = differs(p, ref, frame_a=frame)
    worst = max(worst, d)
    print(f"        {label}: mean difference from the master {d:.1f}/255")
check("Android and iOS carry the same approved artwork", worst < 12,
      f"worst mean difference {worst:.1f}/255 across {len(same)} assets")

# ------------------------------- 5. General English's branding has not moved
pairs = [
    ("Android launcher", MAIN / "mipmap-xxxhdpi/ic_launcher.png", AND / "mipmap-xxxhdpi/ic_launcher.png"),
    ("in-app mark", ROOT / "icon-192.png", ROOT / "branding/welding/icon-192.png"),
]
if (IOS / "AppIcon.appiconset/AppIcon-512@2x.png").exists():
    pairs.append(("iOS app icon", IOS / "AppIcon.appiconset/AppIcon-512@2x.png",
                  IOS / "AppIconWelding.appiconset/AppIconWelding-1024.png"))
for label, ge, weld in pairs:
    d = differs(ge, weld)
    check(f"General English keeps its own {label}", d > 20,
          f"mean difference from the Welding one {d:.1f}/255")

print()
if fails:
    print(f"{len(fails)} check(s) failed: " + ", ".join(fails))
    sys.exit(1)
print("all checks passed")
