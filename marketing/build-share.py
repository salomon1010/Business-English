#!/usr/bin/env python3
"""Downscale a rendered 2x flyer master to the shareable 1080x1920 pair.

The @2x PNG is the print master (build-pdf.py uses it, so an A4 page is not
upscaled from a phone-sized image). WhatsApp only ever shows about 1080 wide and
recompresses anything larger, so the committed share files match the other two
flyers at 1080x1920 — PNG for quality, JPEG for sending.

  python3 marketing/build-share.py career
"""
import sys, pathlib
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
SHARE = (1080, 1920)

for name in (sys.argv[1:] or ["career"]):
    src = HERE / ("%s-flyer@2x.png" % name)
    if not src.exists():
        raise SystemExit("missing master: %s" % src)
    art = Image.open(src).convert("RGB").resize(SHARE, Image.LANCZOS)
    art.save(HERE / ("%s-flyer.png" % name))
    art.save(HERE / ("%s-flyer.jpg" % name), quality=92, optimize=True)
    print("%s -> %s-flyer.png / .jpg  (%dx%d)" % (src.name, name, *SHARE))
