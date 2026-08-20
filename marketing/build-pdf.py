#!/usr/bin/env python3
"""Put both flyers into one two-page PDF, ready to print or attach.

The flyers are 1080x1920 (9:16) and A4 is 1:1.414, so a flyer can never fill an
A4 page. Rather than stretch it or leave it floating on white, each page is
filled with that flyer's own base colour and the artwork is centred on it — the
page reads as designed rather than as a screenshot someone pasted into a doc.

  python3 marketing/build-pdf.py                   # welding first, then English
  ORDER=english python3 marketing/build-pdf.py
  python3 marketing/build-pdf.py career            # just the career poster, own file
  python3 marketing/build-pdf.py polish            # Executive Polish, office
  python3 marketing/build-pdf.py polish-welding    # Executive Polish, site

Output: marketing/be-mastery-flyers.pdf, or marketing/be-mastery-<name>.pdf
        when specific pages are named.

Each poster is its own file rather than one fat handout: they are written for
different rooms, and handing a welder the standup example (or a project manager
the toolbox talk) wastes the page. Naming several pages in one call still
concatenates them, for the rare occasion you want the set.
"""
import os, sys, pathlib
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
DPI = 300                                   # print quality
A4 = (int(8.268 * DPI), int(11.693 * DPI))  # 2480 x 3508 px
MARGIN = int(0.28 * DPI)                    # ~7mm, enough for any printer

PAGES = {
    "welding": HERE / "welding-flyer.png",
    "english": HERE / "whatsapp-flyer.png",
    # the 2x master, so an A4 page at 300dpi is not upscaled from the share file
    "career":  HERE / "career-flyer@2x.png",
    "polish":         HERE / "polish-flyer@2x.png",
    "polish-welding": HERE / "polish-welding-flyer@2x.png",
}
if sys.argv[1:]:
    order = sys.argv[1:]
    unknown = [n for n in order if n not in PAGES]
    if unknown:
        raise SystemExit("unknown page(s): %s (have %s)" % (", ".join(unknown), ", ".join(PAGES)))
    out_name = "be-mastery-%s.pdf" % "-".join(order)
else:
    order = ["english", "welding"] if os.environ.get("ORDER") == "english" else ["welding", "english"]
    out_name = "be-mastery-flyers.pdf"

def page(src):
    art = Image.open(src).convert("RGB")
    # the flyer's own backdrop, sampled from a corner, so the margin disappears
    bg = art.getpixel((4, art.height - 4))
    canvas = Image.new("RGB", A4, bg)
    scale = min((A4[0] - 2 * MARGIN) / art.width, (A4[1] - 2 * MARGIN) / art.height)
    w, h = int(art.width * scale), int(art.height * scale)
    canvas.paste(art.resize((w, h), Image.LANCZOS), ((A4[0] - w) // 2, (A4[1] - h) // 2))
    return canvas

pages = [page(PAGES[k]) for k in order]
out = HERE / out_name
pages[0].save(out, "PDF", resolution=DPI, save_all=True, append_images=pages[1:],
              title="BE Mastery — flyers", author="Lomonec LLC")
print("%s  ·  %d pages (%s)  ·  %.1f MB  ·  A4 @ %d dpi"
      % (out.name, len(pages), ", ".join(order), out.stat().st_size / 1e6, DPI))
