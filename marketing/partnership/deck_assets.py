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


def wash(path, dark=True, bloom_x=0.62):
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


wash(OUT / "deck-dark.jpg")
wash(OUT / "deck-dark-left.jpg", bloom_x=-0.25)
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
