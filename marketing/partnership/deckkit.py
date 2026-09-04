#!/usr/bin/env python3
"""Shared slide kit for the Lomonec partnership decks.

Both the pilot proposal deck and the partner value deck are built from these, so
the palette, the ruled headings, the cards and the branded backgrounds stay in
one place. Branding lives in the background images (see deck_assets.py) rather
than in shapes, so it cannot be dragged off or lost when a slide is duplicated.
"""
import pathlib
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt, Emu

HERE = pathlib.Path(__file__).resolve().parent
A = HERE / "assets"

INK = RGBColor(0x2B, 0x1F, 0x5E)
ACCENT = RGBColor(0x4A, 0x32, 0xDC)
LILAC = RGBColor(0xA7, 0x98, 0xFF)
BODY = RGBColor(0x3A, 0x3A, 0x46)
MUTED = RGBColor(0x6B, 0x70, 0x83)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
PALE = RGBColor(0xCB, 0xC3, 0xF5)
GREEN = RGBColor(0x1D, 0x6B, 0x46)

W, H = Inches(13.333), Inches(7.5)
M = Inches(0.86)                                  # slide margin

def new_deck():
    prs = Presentation()
    prs.slide_width, prs.slide_height = W, H
    return prs


def slide(prs, bg, notes=""):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.shapes.add_picture(str(A / bg), 0, 0, width=W, height=H)
    if notes:
        s.notes_slide.notes_text_frame.text = notes
    return s


def tb(s, x, y, w, h):
    box = s.shapes.add_textbox(x, y, w, h)
    tf = box.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    return tf


def para(tf, text, size, bold=False, colour=BODY, space_after=6, first=False,
         align=PP_ALIGN.LEFT, line=None, italic=False):
    p = tf.paragraphs[0] if first else tf.add_paragraph()
    p.alignment = align
    r = p.add_run(); r.text = text
    f = r.font
    f.name = "Arial"; f.size = Pt(size); f.bold = bold; f.italic = italic
    f.color.rgb = colour
    p.space_after = Pt(space_after)
    if line:
        p.line_spacing = line
    return p


def eyebrow(s, text, colour=ACCENT, y=None):
    tf = tb(s, M, y or Inches(0.62), Inches(11), Inches(0.34))
    p = para(tf, text.upper(), 12.5, True, colour, 0, first=True)
    p.runs[0].font.name = "Arial"
    return tf


def heading(s, text, y=Inches(1.05), size=34, colour=INK, w=Inches(11.6)):
    tf = tb(s, M, y, w, Inches(1.5))
    para(tf, text, size, True, colour, 0, first=True, line=1.06)
    return tf


def rule(s, y, w=Inches(2.0), colour=ACCENT, h=Pt(3.5)):
    from pptx.enum.shapes import MSO_SHAPE
    sh = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, M, y, w, h)
    sh.fill.solid(); sh.fill.fore_color.rgb = colour
    sh.line.fill.background()
    sh.shadow.inherit = False
    return sh


def card(s, x, y, w, h, fill=RGBColor(0xF6, 0xF5, 0xFD),
         line=RGBColor(0xDD, 0xD9, 0xF5)):
    from pptx.enum.shapes import MSO_SHAPE
    sh = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h)
    sh.adjustments[0] = 0.06
    sh.fill.solid(); sh.fill.fore_color.rgb = fill
    sh.line.color.rgb = line; sh.line.width = Pt(1)
    sh.shadow.inherit = False
    return sh


def card_text(s, x, y, w, title, body, tcol=INK, bcol=BODY, tsize=15, bsize=12):
    tf = tb(s, x + Inches(0.28), y + Inches(0.22), w - Inches(0.56), Inches(1))
    para(tf, title, tsize, True, tcol, 5, first=True, line=1.08)
    if body:
        para(tf, body, bsize, False, bcol, 0, line=1.28)
    return tf


def footer(s, dark=False):
    """Only the address. The Lomonec wordmark is on the background, bottom
    left, and the BE Mastery lockup is top right — on every slide."""
    tf = tb(s, Inches(8.0), Inches(6.98), Inches(4.47), Inches(0.3))
    para(tf, "app.lomonec.com  ·  contact@lomonec.com", 9.5, False,
         PALE if dark else MUTED, 0, first=True, align=PP_ALIGN.RIGHT)


