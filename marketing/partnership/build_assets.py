#!/usr/bin/env python3
"""Brand assets for the partnership proposal.

The Lomonec wordmark is rebuilt here rather than shipped as a binary, so the
proposal reproduces from a clean checkout. Proportions are taken from the
supplied logo: the rule above the L spans ~24% of the wordmark, and "EC" is the
accent half. Arial Bold matches the supplied artwork's grotesque.
"""
import pathlib
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "assets"
OUT.mkdir(parents=True, exist_ok=True)
REPO = HERE.parent.parent

BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG  = "/System/Library/Fonts/Supplemental/Arial.ttf"

INK    = (43, 31, 94)      # LOMON — deep indigo
ACCENT = (74, 50, 220)     # EC and the rule — bright indigo
WHITE  = (255, 255, 255)
LILAC  = (167, 152, 255)   # the accent half, on dark ground


def wordmark(path, ink, accent, cap_px=210, pad=6):
    """The Lomonec wordmark: accent rule, then LOMON + EC."""
    f = ImageFont.truetype(BOLD, cap_px)
    probe = Image.new("RGBA", (10, 10)); d = ImageDraw.Draw(probe)
    w_all = d.textlength("LOMONEC", font=f)
    w_lomon = d.textlength("LOMON", font=f)
    bar_h = round(w_all * 0.031)
    bar_w = round(w_all * 0.240)
    gap = round(w_all * 0.028)
    asc, desc = f.getmetrics()
    img = Image.new("RGBA", (round(w_all) + pad * 2,
                             bar_h + gap + asc + desc + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([pad, pad, pad + bar_w, pad + bar_h], fill=accent)
    y = pad + bar_h + gap
    d.text((pad, y), "LOMON", font=f, fill=ink)
    d.text((pad + w_lomon, y), "EC", font=f, fill=accent)
    img = img.crop(img.getbbox())
    img.save(path)
    return img


def app_icon(size):
    """The BE Mastery tile, lifted off the dark plate baked into icon-512.png.

    Pasted straight, that plate reads as a black box on the band. The blue tile
    sits at 46..465 of the 512 canvas; crop to it and re-round the corners."""
    ic = Image.open(REPO / "icon-512.png").convert("RGBA").crop((46, 46, 466, 466))
    ic = ic.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1],
                                           radius=size * 4 // 4.5, fill=255)
    ic.putalpha(mask.resize((size, size), Image.LANCZOS))
    return ic


def header_band(path, W=2480, H=742):
    """Full-bleed masthead: indigo→violet wash, wordmark, eyebrow, headline."""
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    # diagonal wash, dark top-left to violet bottom-right
    for y in range(H):
        for_band = y / H
        d.line([(0, y), (W, y)], fill=(
            round(38 + 26 * for_band), round(28 + 18 * for_band), round(88 + 62 * for_band)))
    # a soft violet bloom on the right so the band is not a flat rectangle
    bloom = Image.new("RGB", (W, H), (0, 0, 0))
    bd = ImageDraw.Draw(bloom)
    bd.ellipse([W * 0.52, -H * 0.9, W * 1.5, H * 1.5], fill=(64, 44, 162))
    bloom = bloom.filter(ImageFilter.GaussianBlur(W // 9))   # no visible arc
    img = Image.blend(img, ImageChops.add(img, bloom), 0.62)
    d = ImageDraw.Draw(img)

    M = 150                                   # matches the document's side margin
    mark = Image.open(OUT / "lomonec-white.png")
    mw = 470
    mark = mark.resize((mw, round(mark.height * mw / mark.width)), Image.LANCZOS)
    img.paste(mark, (M, 96), mark)

    # divider + eyebrow, exactly as the offer sheet sets it
    ex = M + mw + 58
    d.line([(ex, 110), (ex, 110 + mark.height)], fill=(126, 110, 200), width=4)
    fe = ImageFont.truetype(BOLD, 42)
    eyebrow = "INDUSTRIAL TRAINING PARTNERSHIP"
    x = ex + 46
    for ch in eyebrow:                        # letterspacing, Pillow has none
        d.text((x, 110 + mark.height // 2 - 26), ch, font=fe, fill=(196, 186, 255))
        x += d.textlength(ch, font=fe) + 7

    # BE Mastery app icon, right-hand side
    ic = app_icon(190)
    img.paste(ic, (W - M - ic.width, 96), ic)

    fh = ImageFont.truetype(BOLD, 108)
    d.text((M, 332), "BE Mastery × Industrial", font=fh, fill=WHITE)
    d.text((M, 460), "Training Partner", font=fh, fill=WHITE)
    fs = ImageFont.truetype(REG, 48)
    d.text((M, 610), "Professional English & Workplace Communication for Technical Careers",
           font=fs, fill=(203, 195, 245))
    img.save(path, quality=96)


def footer_band(path, W=2480, H=300):
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(round(36 + 14 * t), round(26 + 10 * t), round(84 + 34 * t)))
    M = 150
    fb = ImageFont.truetype(BOLD, 56)
    fr = ImageFont.truetype(REG, 40)
    d.text((M, 78), "BUILD TECHNICAL SKILLS.", font=fb, fill=WHITE)
    d.text((M + d.textlength("BUILD TECHNICAL SKILLS. ", font=fb), 78),
           "COMMUNICATE THEM PROFESSIONALLY.", font=fb, fill=LILAC)
    d.text((M, 168), "Lomonec LLC  ·  BE Mastery  ·  contact@lomonec.com", font=fr,
           fill=(186, 176, 232))
    tw = d.textlength("app.lomonec.com", font=fr)
    d.text((W - M - tw, 168), "app.lomonec.com", font=fr, fill=(167, 152, 255))
    img.save(path, quality=96)


def band(path, W, H, eyebrow_text, lines, sub, headline_px=108, sub_px=48):
    """The masthead, parameterised — the proposal and the target list share it
    so the two documents read as one set."""
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(round(38 + 26 * t), round(28 + 18 * t),
                                       round(88 + 62 * t)))
    bloom = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(bloom).ellipse([W * 0.52, -H * 0.9, W * 1.5, H * 1.5], fill=(64, 44, 162))
    bloom = bloom.filter(ImageFilter.GaussianBlur(W // 9))
    img = Image.blend(img, ImageChops.add(img, bloom), 0.62)
    d = ImageDraw.Draw(img)
    M = 150
    mark = Image.open(OUT / "lomonec-white.png")
    mw = 470
    mark = mark.resize((mw, round(mark.height * mw / mark.width)), Image.LANCZOS)
    img.paste(mark, (M, 96), mark)
    ex = M + mw + 58
    d.line([(ex, 110), (ex, 110 + mark.height)], fill=(126, 110, 200), width=4)
    fe = ImageFont.truetype(BOLD, 42)
    x = ex + 46
    for ch in eyebrow_text:
        d.text((x, 110 + mark.height // 2 - 26), ch, font=fe, fill=(196, 186, 255))
        x += d.textlength(ch, font=fe) + 7
    ic = app_icon(190)
    img.paste(ic, (W - M - ic.width, 96), ic)
    fh = ImageFont.truetype(BOLD, headline_px)
    y = 332
    for ln in lines:
        d.text((M, y), ln, font=fh, fill=WHITE)
        y += round(headline_px * 1.18)
    d.text((M, 610), sub, font=ImageFont.truetype(REG, sub_px), fill=(203, 195, 245))
    img.save(path, quality=96)


def footer_internal(path, W=2480, H=230):
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(round(36 + 14 * t), round(26 + 10 * t),
                                       round(84 + 34 * t)))
    M = 150
    d.text((M, 66), "Internal working document", font=ImageFont.truetype(BOLD, 50), fill=WHITE)
    fr = ImageFont.truetype(REG, 38)
    d.text((M, 134), "Lomonec LLC  ·  BE Mastery  ·  not for circulation to partners",
           font=fr, fill=(186, 176, 232))
    tw = d.textlength("app.lomonec.com", font=fr)
    d.text((W - M - tw, 134), "app.lomonec.com", font=fr, fill=(167, 152, 255))
    img.save(path, quality=96)


wordmark(OUT / "lomonec.png", INK, ACCENT)
wordmark(OUT / "lomonec-white.png", WHITE, LILAC)
header_band(OUT / "header.jpg")
footer_band(OUT / "footer.jpg")
band(OUT / "header-targets.jpg", 2480, 742, "PARTNERSHIP TARGET LIST",
     ["Where to take this", "proposal first"],
     "Africa, Canada and the United States — ordered by how fast each could sign a pilot")
footer_internal(OUT / "footer-internal.jpg")
for p in sorted(OUT.iterdir()):
    im = Image.open(p)
    print("%-22s %sx%s" % (p.name, im.width, im.height))
