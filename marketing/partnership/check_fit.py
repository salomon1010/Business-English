#!/usr/bin/env python3
"""Estimate how full each page of the proposal is.

Word cannot be scripted in this environment and QuickLook renders the document
as one continuous crop, so neither can answer "does page 2 overflow?". This
walks the saved .docx, wraps every paragraph at the real measure using Arial
metrics at the real point size, adds table row heights and cell margins, and
reports the column height each page break section would occupy.
"""
import pathlib
from docx import Document
from docx.shared import Emu, Pt
from docx.oxml.ns import qn
from PIL import ImageFont

HERE = pathlib.Path(__file__).resolve().parent
FONTS = {(False, False): "/System/Library/Fonts/Supplemental/Arial.ttf",
         (True, False):  "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
         (False, True):  "/System/Library/Fonts/Supplemental/Arial Italic.ttf",
         (True, True):   "/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf"}
PX = 4                                   # render at 4x pt for metric accuracy
_cache = {}

def font(size_pt, bold, italic):
    k = (round(size_pt * PX), bold, italic)
    if k not in _cache:
        _cache[k] = ImageFont.truetype(FONTS[(bool(bold), bool(italic))], k[0])
    return _cache[k]

def wrap_lines(text, size_pt, bold, italic, width_cm):
    if not text.strip():
        return 1
    f = font(size_pt, bold, italic)
    limit = width_cm / 2.54 * 72 * PX     # cm -> pt -> px at PX scale
    words, line, n = text.split(), "", 1
    for w in words:
        trial = (line + " " + w).strip()
        if f.getlength(trial) <= limit:
            line = trial
        else:
            n += 1; line = w
    return n

def para_cm(p, width_cm):
    runs = p.runs
    size = 10.0; bold = italic = False
    for r in runs:
        if r.font.size:
            size = r.font.size.pt
        bold = bold or bool(r.font.bold); italic = italic or bool(r.font.italic)
    pf = p.paragraph_format
    ls = pf.line_spacing if isinstance(pf.line_spacing, float) else 1.15
    before = pf.space_before.pt if pf.space_before else 0
    after = pf.space_after.pt if pf.space_after else 0
    ind = 0.0
    if pf.left_indent:
        ind = max(0.0, Emu(pf.left_indent).cm)
    lines = wrap_lines(p.text, size, bold, italic, max(2.0, width_cm - ind))
    # a picture run has no text; use the image's own scaled height
    pic_cm = 0.0
    for r in runs:
        for blip in r._element.findall(".//" + qn("a:blip")):
            pic_cm = 21.0 * 880 / 2480 if "header" in str(blip.attrib) else pic_cm
    body = lines * size * ls
    return (before + after + body) / 72 * 2.54

MEASURE = 17.6
import sys
DOC = sys.argv[1] if len(sys.argv) > 1 else \
    "BE-Mastery-Industrial-Training-Partnership-Proposal.docx"
doc = Document(HERE / DOC)

# images are anchored to their own paragraphs; measure them from the files
# measured from the files themselves — an earlier hand-maintained table drifted
# silently when the masthead was shortened, which quietly skewed every estimate
from PIL import Image as _I
IMG = {f.name: 21.0 * _I.open(f).height / _I.open(f).width
       for f in (HERE / "assets").glob("*.jpg")}

pages, cur, page = [], 0.0, 1
body = doc.element.body
from docx.table import Table
from docx.text.paragraph import Paragraph

def iter_blocks(parent):
    for child in parent.element.body.iterchildren():
        if child.tag == qn("w:p"):
            yield Paragraph(child, parent)
        elif child.tag == qn("w:tbl"):
            yield Table(child, parent)

img_i = 0
img_order = (["header-targets.jpg", "footer-internal.jpg"] if "TARGET" in DOC
             else ["header-jfn.jpg", "footer.jpg"] if "Petrocertif" in DOC
             else ["header-learner.jpg", "footer.jpg"] if "Learner" in DOC
             else ["header-playbook.jpg", "footer.jpg"] if "Playbook" in DOC
             else ["header.jpg", "footer.jpg"])
for blk in iter_blocks(doc):
    if isinstance(blk, Paragraph):
        has_pic = blk._p.findall(".//" + qn("w:drawing"))
        has_brk = blk._p.findall(".//" + qn("w:br"))
        if has_pic:
            cur += IMG[img_order[img_i]]; img_i += 1
            continue
        if has_brk and any(b.get(qn("w:type")) == "page" for b in has_brk):
            pages.append((page, cur)); page += 1; cur = 0.0
            continue
        cur += para_cm(blk, MEASURE)
    else:
        for row in blk.rows:
            h = 0.0
            for c in row.cells:
                cw = Emu(c.width).cm if c.width else MEASURE / len(row.cells)
                inner = max(1.5, cw - 0.55)          # cell side margins
                ch = sum(para_cm(p, inner) for p in c.paragraphs) + 0.26
                h = max(h, ch)
            cur += h
        cur += 0.12
pages.append((page, cur))

USABLE = 29.7 - 1.1        # top margin is 0 (the band bleeds)
print("%s\nusable column height: %.1f cm\n" % (DOC, USABLE))
ok = True
for n, h in pages:
    slack = USABLE - h
    flag = "OK " if slack >= 0.8 else ("TIGHT" if slack >= 0 else "OVERFLOW")
    if slack < 0.8:
        ok = False
    print("  page %d: %5.1f cm used, %5.1f cm free   %s" % (n, h, slack, flag))
print("\n%s" % ("all pages fit with room to spare" if ok else "needs adjustment"))
