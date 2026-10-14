#!/usr/bin/env python3
"""Generate every Welding app icon from the one approved artwork.

    python3 scripts/branding/make-welding-icons.py

THE TWO-APP SPLIT (docs/APP_SPLIT.md). "BE Mastery Welding" is its own store
app on both platforms, so it needs its own launcher icon, its own launch screen
and its own listing icon — and General English must not move. Every file this
script writes belongs to the Welding app alone:

  * the Android `welding` product flavor's mipmaps and splash drawables
    (src/general and src/main are never touched),
  * the iOS AppIconWelding / SplashWelding asset sets, which only the Welding
    build selects (ios/App/Welding.xcconfig sets BE_APPICON_NAME and
    BE_LAUNCH_STORYBOARD; the project's own AppIcon stays General English's),
  * branding/welding/icon-{192,512}.png, which sync-web.mjs copies over the web
    bundle's icons for `--track welding` only, so the Welding app's
    notifications and certificate carry the Welding mark while
    app.lomonec.com keeps the General English one,
  * playstore/welding/play-icon-512.png, the Play listing icon.

Three shapes come out of the one artwork:

  TILE       the rounded-square artwork with its surround removed, so it can be
             composited on any background. Used where Android supplies the
             padding itself (the adaptive-icon foreground).
  FULL       the same artwork with its four rounded corners grown outwards
             until the square is full-bleed. Used for every store icon, because
             Apple and Google round the square themselves — handing them a
             pre-rounded tile would show a dark crescent inside their mask.
             Growing the corners rather than zooming in keeps the artwork at the
             size it was drawn: the spark at the top right stays clear of
             Apple's 22.37% superellipse instead of being cropped by it.
  FRAMED     the artwork on its own dark surround, as drawn. Used for the
             legacy (pre-API-26) launcher icon, which Android shows as-is.
"""
import base64
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / "branding" / "welding" / "logo-master.png"

# The Welding navy: the welding theme's page background, and the colour of the
# adaptive icon's background layer (src/welding/res/values/ic_launcher_background.xml).
NAVY = (10, 14, 26)

# The artwork's own dark surround, measured from the master's corner pixel. Used
# only to find the tile inside it.
SURROUND_TOLERANCE = 40


def load_master():
    if not MASTER.exists():
        sys.exit(f"missing {MASTER.relative_to(ROOT)}")
    im = Image.open(MASTER).convert("RGB")
    if im.width != im.height:
        sys.exit(f"the master must be square, got {im.size}")
    return im


def tile_mask(im):
    """Alpha for the rounded-square artwork, with its dark surround removed.

    Derived from the picture rather than assumed, because the artwork's corner
    is a squircle and a plain rounded rectangle leaves a halo. The row/column
    fill below is safe because the tile is convex."""
    a = np.asarray(im).astype(int)
    surround = np.array(a[0, 0])
    d = np.abs(a - surround).sum(axis=2)
    m = d > SURROUND_TOLERANCE
    filled = np.zeros_like(m)
    for axis in (0, 1):
        idx = np.arange(m.shape[axis])
        big = np.where(m, idx.reshape(-1, 1) if axis == 0 else idx.reshape(1, -1), -1)
        small = np.where(m, idx.reshape(-1, 1) if axis == 0 else idx.reshape(1, -1), 10**9)
        lo = small.min(axis=axis, keepdims=True)
        hi = big.max(axis=axis, keepdims=True)
        span = (idx.reshape(-1, 1) if axis == 0 else idx.reshape(1, -1))
        filled |= (span >= lo) & (span <= hi) & (hi >= 0)
    alpha = Image.fromarray((filled * 255).astype(np.uint8), "L")
    # one pixel of feather so the composite has no stair-stepped edge
    return alpha.filter(ImageFilter.GaussianBlur(0.7))


def grow_to_square(tile):
    """Fill what lies outside the artwork's rounded corners, so the square is
    full-bleed and the stores' own masks have something to round off.

    The filler is the artwork itself, enlarged until its corners are gone and
    then blurred: because the enlargement is about the same centre, every corner
    of the plate carries the colours that lie along that same diagonal, so the
    blue stays blue and the ember stays orange. The sharp artwork is laid back
    on top, so only the corner slivers are ever the blurred plate.

    Growing the corners rather than zooming the whole picture keeps the artwork
    at the size it was drawn: the spark at the top right stays clear of Apple's
    22.37% superellipse instead of being cropped by it."""
    side = tile.width
    zoom = round(side * 1.35)
    plate = tile.convert("RGB").resize((zoom, zoom), Image.LANCZOS)
    off = (zoom - side) // 2
    plate = plate.crop((off, off, off + side, off + side))
    plate = plate.filter(ImageFilter.GaussianBlur(side * 0.05))
    plate.paste(tile, (0, 0), tile)
    return plate


def bbox_of(alpha):
    a = np.asarray(alpha)
    ys, xs = np.nonzero(a > 128)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def shapes(im):
    alpha = tile_mask(im)
    x0, y0, x1, y1 = bbox_of(alpha)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side = max(x1 - x0, y1 - y0)

    tile = im.copy()
    tile.putalpha(alpha)
    tile = tile.crop((int(cx - side / 2), int(cy - side / 2), int(cx + side / 2), int(cy + side / 2)))

    full = grow_to_square(tile)

    # FRAMED: the artwork as drawn, with a 5% surround — the margin the previous
    # Welding launcher icon used.
    framed_side = side / 0.90
    framed = im.crop((int(cx - framed_side / 2), int(cy - framed_side / 2),
                      int(cx + framed_side / 2), int(cy + framed_side / 2)))
    return tile, full, framed


def square(img, size, background=None):
    out = img.resize((size, size), Image.LANCZOS)
    if background is None:
        return out
    canvas = Image.new("RGB", (size, size), background)
    canvas.paste(out, (0, 0), out if out.mode == "RGBA" else None)
    return canvas


def on_pad(art_img, canvas_size, fraction, background=NAVY):
    """The artwork centred on an opaque pad — the adaptive-icon foreground."""
    art = max(1, round(canvas_size * fraction))
    canvas = Image.new("RGB", (canvas_size, canvas_size), background)
    t = art_img.resize((art, art), Image.LANCZOS)
    off = (canvas_size - art) // 2
    canvas.paste(t, (off, off), t if t.mode == "RGBA" else None)
    return canvas


def splash(tile, w, h, fraction=0.30, background=NAVY):
    art = max(1, round(min(w, h) * fraction))
    canvas = Image.new("RGB", (w, h), background)
    t = tile.resize((art, art), Image.LANCZOS)
    canvas.paste(t, ((w - art) // 2, (h - art) // 2), t)
    return canvas


def write(img, rel):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    img.save(p, "PNG", optimize=True)
    print(f"  {rel}  {img.width}x{img.height}")
    return p


# density -> (legacy launcher px, adaptive layer px)
DENSITIES = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216),
             "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}
# Capacitor's splash drawable set, as the General English app already carries it.
SPLASH_PORT = {"mdpi": (320, 480), "hdpi": (480, 800), "xhdpi": (720, 1280),
               "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}
SPLASH_LAND = {"mdpi": (480, 320), "hdpi": (800, 480), "xhdpi": (1280, 720),
               "xxhdpi": (1600, 960), "xxxhdpi": (1920, 1280)}

AND = "mobile/android/android/app/src/welding/res"
IOS = "mobile/ios/ios/App/App/Assets.xcassets"


def main():
    im = load_master()
    tile, full, framed = shapes(im)
    print(f"master {MASTER.relative_to(ROOT)} {im.size}")

    print("branding masters")
    write(square(full, 1024), "branding/welding/icon-1024.png")
    write(square(full, 512), "branding/welding/icon-512.png")
    write(square(full, 192), "branding/welding/icon-192.png")
    # logo.svg is the mark index.html draws in the header, the onboarding hero,
    # the About row and the sign-in sheet — an <img src="logo.svg">, so the
    # Welding bundle's copy has to keep that name and that type. The artwork is
    # a raster, so the file is an SVG wrapper around it: an SVG used as an image
    # may not reach out to another file, but a data: URI inside it is part of
    # the same document and renders everywhere the app runs.
    png = (ROOT / "branding/welding/icon-192.png").read_bytes()
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
           'viewBox="0 0 192 192" width="192" height="192" role="img" aria-label="BE Mastery Welding">'
           '<image width="192" height="192" xlink:href="data:image/png;base64,'
           + base64.b64encode(png).decode("ascii") + '"/></svg>\n')
    (ROOT / "branding/welding/logo.svg").write_text(svg)
    print(f"  branding/welding/logo.svg  {len(svg) // 1024} KB")

    print("Play listing")
    write(square(full, 512), "playstore/welding/play-icon-512.png")

    print("Android launcher (welding flavor)")
    for d, (legacy, layer) in DENSITIES.items():
        icon = square(framed, legacy)
        write(icon, f"{AND}/mipmap-{d}/ic_launcher.png")
        # Android asks for a round variant; the artwork is the same picture, as
        # it was before this logo — the launcher applies the circular mask.
        write(icon, f"{AND}/mipmap-{d}/ic_launcher_round.png")
        # 72/108 is the adaptive icon's visible viewport: the artwork fills it
        # edge to edge and the launcher's own mask rounds the square, exactly as
        # iOS does, instead of the artwork sitting as a small tile on a navy
        # border. The full-bleed shape is used for the same reason the store
        # icons use it. Nothing of the mark is lost: the bubble, the helmet and
        # the spark all sit inside the inner 66dp safe zone, which is what the
        # circular-mask check in verify-welding-icons.py measures.
        write(on_pad(full, layer, 72 / 108), f"{AND}/mipmap-{d}/ic_launcher_foreground.png")

    print("Android splash (welding flavor)")
    write(splash(tile, *SPLASH_PORT["mdpi"]), f"{AND}/drawable/splash.png")
    for d, (w, h) in SPLASH_PORT.items():
        write(splash(tile, w, h), f"{AND}/drawable-port-{d}/splash.png")
    for d, (w, h) in SPLASH_LAND.items():
        write(splash(tile, w, h), f"{AND}/drawable-land-{d}/splash.png")

    print("iOS app icon (Welding build only)")
    write(square(full, 1024), f"{IOS}/AppIconWelding.appiconset/AppIconWelding-1024.png")
    (ROOT / IOS / "AppIconWelding.appiconset" / "Contents.json").write_text(json.dumps({
        "images": [{"filename": "AppIconWelding-1024.png", "idiom": "universal",
                    "platform": "ios", "size": "1024x1024"}],
        "info": {"author": "make-welding-icons.py", "version": 1},
    }, indent=2) + "\n")

    print("iOS launch screen (Welding build only)")
    # One file, not the three identical copies Capacitor's template carries for
    # 1x/2x/3x: a single-scale imageset is the same picture at a third of the
    # size, and the launch screen scales it to fill whatever screen it is on.
    write(splash(tile, 2732, 2732, fraction=0.22), f"{IOS}/SplashWelding.imageset/splash-2732x2732.png")
    (ROOT / IOS / "SplashWelding.imageset" / "Contents.json").write_text(json.dumps({
        "images": [{"idiom": "universal", "filename": "splash-2732x2732.png"}],
        "info": {"version": 1, "author": "make-welding-icons.py"},
    }, indent=2) + "\n")
    print("done")


if __name__ == "__main__":
    main()
