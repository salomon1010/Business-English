#!/usr/bin/env python3
"""Slide imagery for the pilot presentation.

Backgrounds and phone frames are rendered here rather than dropped in as
binaries, so the deck reproduces from a clean checkout and restyles in one
place if the palette moves.
"""
import pathlib
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = HERE / "assets"
OUT.mkdir(exist_ok=True)

BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
W, H = 2560, 1440                       # 16:9 at slide resolution
INK = (43, 31, 94)
ACCENT = (74, 50, 220)
LILAC = (167, 152, 255)
WHITE = (255, 255, 255)


def app_icon(size):
    """The BE Mastery tile, lifted off the dark plate baked into icon-512.png
    (the blue tile sits at 46..465 of the 512 canvas) and re-rounded."""
    ic = Image.open(REPO / "icon-512.png").convert("RGBA").crop((46, 46, 466, 466))
    ic = ic.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1],
                                           radius=int(size * 4 / 4.5), fill=255)
    ic.putalpha(mask.resize((size, size), Image.LANCZOS))
    return ic


def be_lockup(size=96, on_dark=False):
    """App tile + wordmark: BE in the text colour, Mastery in the accent, the
    way the app sets its own header."""
    ic = app_icon(size)
    fb = ImageFont.truetype(BOLD, int(size * 0.60))
    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    w_be = probe.textlength("BE ", font=fb)
    w_ma = probe.textlength("Mastery", font=fb)
    gap = int(size * 0.30)
    img = Image.new("RGBA", (size + gap + int(w_be + w_ma) + 6, size), (0, 0, 0, 0))
    img.paste(ic, (0, 0), ic)
    d = ImageDraw.Draw(img)
    ty = int(size * 0.5 - size * 0.60 * 0.62)
    d.text((size + gap, ty), "BE ", font=fb, fill=WHITE if on_dark else INK)
    d.text((size + gap + w_be, ty), "Mastery", font=fb,
           fill=LILAC if on_dark else ACCENT)
    return img.crop(img.getbbox())


def brand(img, on_dark):
    """Lomonec bottom-left, BE Mastery top-right — on every single slide.
    The company brand is the thing being sold here, not just the app."""
    M = 118
    mark = Image.open(OUT / ("lomonec-white.png" if on_dark else "lomonec.png"))
    mw = 268
    mark = mark.resize((mw, round(mark.height * mw / mark.width)), Image.LANCZOS)
    img.paste(mark, (M, H - 60 - mark.height), mark)
    lock = be_lockup(74, on_dark)
    img.paste(lock, (W - M - lock.width, M - 16), lock)
    return img


def wash(path, dark=True, bloom_x=0.62, branded=True):
    """The brand wash: indigo to violet, with a soft bloom off to one side."""
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(round(34 + 26 * t), round(24 + 18 * t),
                                       round(82 + 62 * t)))
    bloom = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(bloom).ellipse(
        [W * bloom_x, -H * 0.8, W * (bloom_x + 0.95), H * 1.7], fill=(66, 46, 168))
    bloom = bloom.filter(ImageFilter.GaussianBlur(W // 8))
    img = Image.blend(img, ImageChops.add(img, bloom), 0.62)
    if branded:
        brand(img, on_dark=True)
    img.save(path, quality=95)


def light(path):
    """Content slides: near-white with a faint lavender corner, so a projector
    keeps the text legible but the deck is not a blank page."""
    img = Image.new("RGB", (W, H), (255, 255, 255))
    tint = Image.new("RGB", (W, H), (255, 255, 255))
    ImageDraw.Draw(tint).ellipse([W * 0.55, -H * 0.7, W * 1.6, H * 0.9],
                                 fill=(238, 235, 252))
    tint = tint.filter(ImageFilter.GaussianBlur(W // 7))
    img = Image.blend(img, tint, 0.85)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 14], fill=(74, 50, 220))      # accent rule at the top
    brand(img, on_dark=False)
    img.save(path, quality=95)


def phone(src, dest, crop=None, height=1180):
    """A screenshot in a rounded device frame with a drop shadow, on
    transparency, so it can sit on either background."""
    im = Image.open(src).convert("RGB")
    if crop:
        im = im.crop(crop)
    scale = height / im.height
    im = im.resize((round(im.width * scale), height), Image.LANCZOS)
    r = round(height * 0.055)
    mask = Image.new("L", (im.width * 3, im.height * 3), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, im.width * 3 - 1, im.height * 3 - 1], radius=r * 3, fill=255)
    im.putalpha(mask.resize(im.size, Image.LANCZOS))
    bez = 10
    frame = Image.new("RGBA", (im.width + bez * 2, im.height + bez * 2), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, frame.width - 1, frame.height - 1],
                         radius=r + bez, fill=(24, 20, 48, 255))
    frame.paste(im, (bez, bez), im)
    pad = 90
    canvas = Image.new("RGBA", (frame.width + pad * 2, frame.height + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [pad, pad + 22, pad + frame.width, pad + 22 + frame.height],
        radius=r + bez, fill=(12, 8, 34, 165))
    shadow = shadow.filter(ImageFilter.GaussianBlur(38))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.paste(frame, (pad, pad), frame)
    canvas.save(dest)


def title_bg(path):
    # no small repeats here — the title slide carries the pair full size
    wash(path, branded=False)
    img = Image.open(path).convert("RGB")
    lock = be_lockup(150, on_dark=True)
    mark = Image.open(OUT / "lomonec-white.png")
    mw = 560
    mark = mark.resize((mw, round(mark.height * mw / mark.width)), Image.LANCZOS)
    top = 150
    img.paste(mark, (150, top), mark)
    d = ImageDraw.Draw(img)
    fx = ImageFont.truetype(REG, 76)
    x = 150 + mw + 66
    d.text((x, top + mark.height // 2 - 46), "×", font=fx, fill=(150, 134, 226))
    img.paste(lock, (x + 90, top + mark.height // 2 - lock.height // 2), lock)
    img.save(path, quality=95)


wash(OUT / "deck-dark.jpg")
wash(OUT / "deck-dark-left.jpg", bloom_x=-0.25)
title_bg(OUT / "deck-title.jpg")
light(OUT / "deck-light.jpg")

SHOTS = REPO / "marketing/shots-welding"
# the report screen ends on a "scoring didn't come back" error state; the slide
# uses the top two thirds, which is the part being talked about anyway
phone(SHOTS / "w3-report.png", OUT / "phone-report.png", crop=(0, 0, 540, 830))
phone(SHOTS / "w4-scenarios.png", OUT / "phone-scenarios.png")
phone(SHOTS / "w5-conversation.png", OUT / "phone-conversation.png")
phone(SHOTS / "w2-coaches.png", OUT / "phone-coaches.png")
phone(SHOTS / "w1-career.png", OUT / "phone-career.png")

for p in sorted(OUT.glob("deck-*.jpg")) + sorted(OUT.glob("phone-*.png")):
    im = Image.open(p)
    print("%-28s %sx%s" % (p.name, im.width, im.height))
