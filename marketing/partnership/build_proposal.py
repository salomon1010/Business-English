#!/usr/bin/env python3
"""BE Mastery x Industrial Training Partner — partnership proposal (.docx).

Design follows the Lomonec offer sheet: indigo masthead, letterspaced rules over
purple section headings, lavender cards, a dark closing band. Branding is
rendered to images by build_assets.py; everything else is real, editable Word
text so the partner name and pilot numbers can be changed without a designer.

  python3 build_assets.py && python3 build_proposal.py
"""
import pathlib
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor, Emu

HERE = pathlib.Path(__file__).resolve().parent
A = HERE / "assets"

INK    = RGBColor(0x2B, 0x1F, 0x5E)   # deep indigo — headings, dark cards
ACCENT = RGBColor(0x4A, 0x32, 0xDC)   # bright indigo — rules, eyebrows, numerals
BODY   = RGBColor(0x3A, 0x3A, 0x46)
MUTED  = RGBColor(0x6B, 0x70, 0x83)
WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
LILAC  = RGBColor(0xA7, 0x98, 0xFF)
CARD   = "EFEDFB"                     # lavender card fill
CARD2  = "F6F5FD"
DARK   = "2B1F5E"
GOLD   = "FFF7E3"
MINT   = "EAF6F0"

PAGE_W = Cm(21.0)
MARGIN = Cm(1.7)
CONTENT_W = Cm(21.0 - 1.7 * 2)


# ---------- low-level Word helpers python-docx does not expose ----------
def shade(cell, hexfill):
    el = OxmlElement("w:shd"); el.set(qn("w:val"), "clear"); el.set(qn("w:fill"), hexfill)
    cell._tc.get_or_add_tcPr().append(el)

def cell_margins(cell, top=140, start=160, bottom=140, end=160):
    mar = OxmlElement("w:tcMar")
    for tag, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        e = OxmlElement("w:" + tag); e.set(qn("w:w"), str(v)); e.set(qn("w:type"), "dxa")
        mar.append(e)
    cell._tc.get_or_add_tcPr().append(mar)

def no_borders(table):
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement("w:" + edge); e.set(qn("w:val"), "none"); e.set(qn("w:sz"), "0")
        b.append(e)
    table._tbl.tblPr.append(b)

def cell_border(cell, colour="DDD9F5", sz=6, edges=("top", "left", "bottom", "right")):
    pr = cell._tc.get_or_add_tcPr()
    b = OxmlElement("w:tcBorders")
    for edge in edges:
        e = OxmlElement("w:" + edge)
        e.set(qn("w:val"), "single"); e.set(qn("w:sz"), str(sz))
        e.set(qn("w:space"), "0"); e.set(qn("w:color"), colour)
        b.append(e)
    pr.append(b)

def spacing(run, twentieths):
    """Letterspacing — the offer sheet's eyebrows depend on it."""
    e = OxmlElement("w:spacing"); e.set(qn("w:val"), str(twentieths))
    run._element.get_or_add_rPr().append(e)

def para_rule(p, colour="4A32DC", sz=10):
    pr = p._p.get_or_add_pPr()
    b = OxmlElement("w:pBdr")
    e = OxmlElement("w:bottom")
    e.set(qn("w:val"), "single"); e.set(qn("w:sz"), str(sz))
    e.set(qn("w:space"), "4"); e.set(qn("w:color"), colour)
    b.append(e); pr.append(b)

def keep_with_next(p):
    pr = p._p.get_or_add_pPr()
    e = OxmlElement("w:keepNext"); pr.append(e)


# ---------- typographic building blocks ----------
def txt(container, text="", size=10, bold=False, colour=BODY, before=0, after=6,
        align=None, line=1.32, italic=False, font="Arial"):
    p = container.add_paragraph() if hasattr(container, "add_paragraph") else container
    r = p.add_run(text)
    r.font.name = font; r.font.size = Pt(size); r.font.bold = bold
    r.font.italic = italic; r.font.color.rgb = colour
    pf = p.paragraph_format
    pf.space_before = Pt(before); pf.space_after = Pt(after)
    pf.line_spacing = line
    if align is not None:
        p.alignment = align
    return p

def eyebrow(container, text, colour=ACCENT, size=7.5, before=0, after=3):
    p = txt(container, "", size=size, before=before, after=after)
    r = p.runs[0]; r.text = text.upper()
    r.font.bold = True; r.font.color.rgb = colour; r.font.size = Pt(size)
    spacing(r, 30)
    return p

def section_head(doc, number, title):
    p = txt(doc, "", size=7.5, before=11, after=2)
    r = p.runs[0]; r.text = number
    r.font.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = ACCENT
    spacing(r, 30)
    h = txt(doc, title, size=15, bold=True, colour=INK, before=0, after=5, line=1.1)
    para_rule(h)
    keep_with_next(h)
    return h

def bullet(cell, lead, rest, tick="✓"):
    p = cell.add_paragraph()
    pf = p.paragraph_format
    pf.space_before = Pt(0); pf.space_after = Pt(5); pf.line_spacing = 1.28
    pf.left_indent = Cm(0.52); pf.first_line_indent = Cm(-0.52)
    r = p.add_run(tick + "  ")
    r.font.name = "Arial"; r.font.size = Pt(9); r.font.bold = True; r.font.color.rgb = ACCENT
    r = p.add_run(lead)
    r.font.name = "Arial"; r.font.size = Pt(9); r.font.bold = True; r.font.color.rgb = INK
    if rest:
        r = p.add_run(rest)
        r.font.name = "Arial"; r.font.size = Pt(9); r.font.color.rgb = BODY
    return p

def card(cell, fill, title, body, title_colour=INK, body_colour=BODY,
         eyebrow_text=None, border="DDD9F5"):
    shade(cell, fill); cell_margins(cell); cell_border(cell, border)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
    first = cell.paragraphs[0]
    first.text = ""
    if eyebrow_text:
        r = first.add_run(eyebrow_text.upper())
        r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7)
        r.font.color.rgb = ACCENT if fill != DARK else LILAC
        spacing(r, 30)
        first.paragraph_format.space_after = Pt(3)
        first.paragraph_format.space_before = Pt(0)
        tp = cell.add_paragraph()
    else:
        tp = first
    r = tp.add_run(title)
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(10.5)
    r.font.color.rgb = title_colour
    tp.paragraph_format.space_before = Pt(0); tp.paragraph_format.space_after = Pt(3)
    tp.paragraph_format.line_spacing = 1.18
    if body:
        bp = cell.add_paragraph()
        r = bp.add_run(body)
        r.font.name = "Arial"; r.font.size = Pt(9); r.font.color.rgb = body_colour
        bp.paragraph_format.space_before = Pt(0); bp.paragraph_format.space_after = Pt(0)
        bp.paragraph_format.line_spacing = 1.32
    return cell

def pin_width(table, widths):
    """Pin the table to the full measure, in percent.

    Fixed layout plus dxa widths is the textbook answer, but a reader that
    autofits anyway still shrink-wraps a table whose cells are short — which is
    what happened to the welder-pathway table. Percentages are honoured on both
    paths, so the table fills the measure regardless of how it is laid out. The
    dxa values stay on the grid as the proportion hint.
    """
    total = sum(int(x) for x in widths)
    pr = table._tbl.tblPr
    lay = OxmlElement("w:tblLayout"); lay.set(qn("w:type"), "fixed"); pr.append(lay)
    w = OxmlElement("w:tblW")
    w.set(qn("w:w"), "5000"); w.set(qn("w:type"), "pct")
    pr.append(w)
    for row in table.rows:
        for cell, cw in zip(row.cells, widths):
            tcpr = cell._tc.get_or_add_tcPr()
            for old in tcpr.findall(qn("w:tcW")):
                tcpr.remove(old)
            e = OxmlElement("w:tcW")
            e.set(qn("w:w"), str(round(int(cw) / total * 5000)))
            e.set(qn("w:type"), "pct")
            tcpr.insert(0, e)


def grid(doc, rows, cols, widths=None, after=Pt(8)):
    t = doc.add_table(rows=rows, cols=cols)
    t.autofit = False
    no_borders(t)
    w = [Emu(int(x)) for x in (widths or [CONTENT_W / cols] * cols)]
    for i, col in enumerate(t.columns):
        col.width = w[i]                 # w:tblGrid — what fixed layout reads
    for row in t.rows:
        for i, c in enumerate(row.cells):
            c.width = w[i]               # w:tcW — what the autofit path reads
    pin_width(t, w)
    return t


GAP = Cm(0.34)


def card_grid(doc, rows, cols):
    """Cards with real gutters: spacer columns and rows between them, so each
    card reads as its own box the way the offer sheet's do, rather than as one
    ruled block."""
    cw = Cm((CONTENT_W.cm - GAP.cm * (cols - 1)) / cols)
    widths = []
    for i in range(cols):
        widths.append(cw)
        if i < cols - 1:
            widths.append(GAP)
    t = grid(doc, rows * 2 - 1, len(widths), widths)
    for ri, row in enumerate(t.rows):
        if ri % 2:                                  # spacer row
            row.height = GAP
            for c in row.cells:
                cell_margins(c, 0, 0, 0, 0)
                c.paragraphs[0].paragraph_format.space_after = Pt(0)
                c.paragraphs[0].runs and None
                c.paragraphs[0].add_run("").font.size = Pt(1)
    return t, (lambda r, c: t.cell(r * 2, c * 2))

def gutter(doc, pts=6):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
    p.add_run("").font.size = Pt(pts)
    return p

def bleed_image(doc, path, width=PAGE_W):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = -MARGIN; pf.right_indent = -MARGIN
    pf.space_before = Pt(0); pf.space_after = Pt(0); pf.line_spacing = 1.0
    p.add_run().add_picture(str(path), width=width)
    return p


# OOXML fixes the order of the children of w:tblPr and w:tcPr. Appending as we
# went produced [tblBorders, tblLayout, tblW] and [shd, tcMar, tcBorders], which
# a reader may silently drop — the welder-pathway table, the one with short
# cells, fell back to autofit and collapsed to two-thirds of the measure. Sort
# both into schema order before saving.
TBLPR_ORDER = ["tblStyle", "tblpPr", "tblOverlap", "bidiVisual",
               "tblStyleRowBandSize", "tblStyleColBandSize", "tblW", "jc",
               "tblCellSpacing", "tblInd", "tblBorders", "shd", "tblLayout",
               "tblCellMar", "tblLook", "tblCaption", "tblDescription"]
TCPR_ORDER = ["cnfStyle", "tcW", "gridSpan", "hMerge", "vMerge", "tcBorders",
              "shd", "noWrap", "tcMar", "textDirection", "tcFitText", "vAlign",
              "hideMark"]


def _sort_pr(pr, order):
    if pr is None:
        return
    rank = {qn("w:" + n): i for i, n in enumerate(order)}
    kids = list(pr)
    kids.sort(key=lambda e: rank.get(e.tag, len(order)))
    for e in kids:
        pr.append(e)


def normalise(doc):
    for t in doc.tables:
        _sort_pr(t._tbl.tblPr, TBLPR_ORDER)
        for row in t.rows:
            for c in row.cells:
                _sort_pr(c._tc.tcPr, TCPR_ORDER)


# =========================== the document ===========================
doc = Document()
st = doc.styles["Normal"]
st.font.name = "Arial"; st.font.size = Pt(10); st.font.color.rgb = BODY
st.paragraph_format.space_after = Pt(6)

s = doc.sections[0]
s.page_width, s.page_height = PAGE_W, Cm(29.7)
s.top_margin = Cm(0); s.bottom_margin = Cm(1.1)
s.left_margin = MARGIN; s.right_margin = MARGIN

# ---------------- page 1 ----------------
bleed_image(doc, A / "header.jpg")

txt(doc, "Industrial professionals need more than technical knowledge. They must also explain "
         "their work, understand instructions, report problems, discuss safety, communicate with "
         "supervisors and inspectors, and perform confidently in professional interviews.",
    size=10.2, before=12, after=5, line=1.34)
txt(doc, "BE Mastery complements an Industrial Training Partner’s technical programs with "
         "profession-specific English communication practice.",
    size=10.2, after=9, line=1.34)

t = grid(doc, 1, 3, [Cm(CONTENT_W.cm * 0.52 - GAP.cm / 2), GAP,
                     Cm(CONTENT_W.cm * 0.48 - GAP.cm / 2)])
card(t.cell(0, 0), DARK, "Technical competence gets the work done. "
     "Professional communication helps that competence travel.", None,
     title_colour=WHITE, eyebrow_text="The opportunity", border=DARK)
c = t.cell(0, 2)
card(c, CARD, "Training Partner", "Develops technical capability.", eyebrow_text="Our role")
p = c.add_paragraph()
r = p.add_run("BE Mastery")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(10.5); r.font.color.rgb = INK
p.paragraph_format.space_before = Pt(7); p.paragraph_format.space_after = Pt(3)
txt(c.add_paragraph(), "", size=9)
c.paragraphs[-1].add_run("Helps learners communicate that capability in professional English.")\
    .font.size = Pt(9)
for r_ in c.paragraphs[-1].runs:
    r_.font.name = "Arial"; r_.font.color.rgb = BODY
gutter(doc)

section_head(doc, "01", "What BE Mastery Adds")
txt(doc, "A voice-first professional communication environment built around realistic industrial "
         "situations rather than generic English lessons — safety briefings, shift handovers, "
         "equipment checks, drawing clarification, procedure discussions, QA/QC issue reporting, "
         "supervisor communication, site coordination and professional interviews.",
    size=10, after=7, line=1.36)

feat = [
    ("AI voice simulations",
     "12 workplace scenarios with a five-person cast — HR, supervisor, coworker, "
     "safety officer and QA inspector — in one conversation."),
    ("Technical English & vocabulary",
     "Terminology from welding, fabrication, drawings, procedures, safety and quality, drawn "
     "from what the learner actually says."),
    ("Personalised coaching",
     "Every spoken answer is measured against what a competent answer needs: what was "
     "covered, what was missed, and the sentence that would have carried it."),
    ("Communication evidence",
     "A record of answers spoken, coverage, best take and the trade words used — every "
     "figure from speech, never from opening a screen."),
    ("Career preparation",
     "12 interview coaches, each on one part of the professional story, plus destination "
     "guidance and a CV & LinkedIn coach."),
    ("Reaches the learner where they are",
     "Instructions in 15 languages, works offline after first load, installs from the "
     "browser on Android and iPhone."),
]
t, at = card_grid(doc, 3, 2)
for i, (title, body) in enumerate(feat):
    card(at(i // 2, i % 2), CARD2 if i < 4 else GOLD, title, body,
         border="DDD9F5" if i < 4 else "F0DFB4")

# ---------------- page 2 ----------------
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
gutter(doc, 10)
section_head(doc, "02", "Example: International Welder Pathway")
txt(doc, "The communication layer is aligned to the learner’s technical journey, so practice "
         "feels directly connected to the work.", size=10, after=8, line=1.4)

rows = [
    ("Welding procedures / WPS", "Explain a procedure and clarify requirements"),
    ("Safety & HSE", "Take part in a safety briefing and a stop-work conversation"),
    ("Drawings & isometrics", "Request and provide technical clarification"),
    ("Fabrication & equipment", "Report equipment or material problems"),
    ("QA/QC & inspection", "Discuss a weld-quality concern with an inspector"),
    ("Workplace operations", "Conduct shift handovers and supervisor briefings"),
    ("Career preparation", "Complete professional welding interview simulations"),
]
t = grid(doc, len(rows) + 1, 2, [CONTENT_W * 0.42, CONTENT_W * 0.58])
for j, h in enumerate(("Technical training", "BE Mastery communication practice")):
    c = t.cell(0, j); shade(c, DARK); cell_margins(c, 100, 150, 100, 150)
    p = c.paragraphs[0]; p.text = ""
    r = p.add_run(h.upper())
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = WHITE
    spacing(r, 26)
    p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
for i, (a, b) in enumerate(rows, start=1):
    for j, v in enumerate((a, b)):
        c = t.cell(i, j)
        shade(c, "FFFFFF" if i % 2 else "F6F5FD")
        cell_margins(c, 90, 150, 90, 150)
        cell_border(c, "E4E1F6", 4)
        p = c.paragraphs[0]; p.text = ""
        r = p.add_run(v)
        r.font.name = "Arial"; r.font.size = Pt(9.5)
        r.font.bold = (j == 0); r.font.color.rgb = INK if j == 0 else BODY
        p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.25
txt(doc, "The same model can later support construction supervisors, piping professionals, QA/QC "
         "personnel, maintenance technicians, instrumentation professionals and other industrial "
         "occupations.", size=9, colour=MUTED, before=7, after=4, line=1.4)

section_head(doc, "03", "Proposed Pilot Partnership")
t, at = card_grid(doc, 1, 3)
for i, (big, lab) in enumerate((("20–30", "learners"), ("4", "weeks"),
                                ("1", "technical pathway"))):
    c = at(0, i); shade(c, CARD); cell_margins(c, 130, 150, 130, 150)
    cell_border(c, "D6D0F4")
    p = c.paragraphs[0]; p.text = ""
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(big)
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(20); r.font.color.rgb = ACCENT
    p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
    p2 = c.add_paragraph(); p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p2.add_run(lab.upper())
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = INK
    spacing(r, 26)
    p2.paragraph_format.space_before = Pt(1); p2.paragraph_format.space_after = Pt(0)
gutter(doc, 8)
txt(doc, "The Industrial Training Partner identifies a learner cohort and continues delivering its "
         "normal technical curriculum. BE Mastery provides complementary professional-English "
         "missions and workplace simulations aligned with that training.",
    size=10, after=5, line=1.42)
# The source proposal carried the evaluation criteria as one long sentence, where
# a training director cannot scan them. Same seven items, set as a checklist.
txt(doc, "Success is agreed before the pilot starts, not argued about afterwards. Seven things "
         "are measured together:", size=10, after=7, line=1.4)
t = grid(doc, 1, 3, [Cm(CONTENT_W.cm * 0.5 - GAP.cm / 2), GAP,
                     Cm(CONTENT_W.cm * 0.5 - GAP.cm / 2)])
measures = [
    ("Activation", " — learners who start and complete setup"),
    ("Participation", " — learners active across the four weeks"),
    ("Speaking activities", " — workplace simulations completed"),
    ("Recurring usage", " — learners returning week on week"),
    ("Learner feedback", " — confidence and perceived usefulness"),
    ("Communication evidence", " — coverage and answer quality over repeated attempts"),
    ("Instructor observations", " — what teaching staff notice in class"),
]
for col, items in ((0, measures[:4]), (2, measures[4:])):
    c = t.cell(0, col)
    shade(c, CARD2); cell_margins(c, 140, 160, 140, 160); cell_border(c)
    c.paragraphs[0].text = ""
    c.paragraphs[0].paragraph_format.space_after = Pt(0)
    c.paragraphs[0].add_run("").font.size = Pt(1)
    for lead, rest in items:
        bullet(c, lead, rest)
    c.paragraphs[-1].paragraph_format.space_after = Pt(0)
gutter(doc, 8)

t = grid(doc, 1, 1, [CONTENT_W])
c = t.cell(0, 0); shade(c, MINT); cell_margins(c, 150, 170, 150, 170)
cell_border(c, "BFE0CE")
p = c.paragraphs[0]; p.text = ""
r = p.add_run("THE PILOT QUESTION")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5)
r.font.color.rgb = RGBColor(0x1D, 0x6B, 0x46)
spacing(r, 30)
p.paragraph_format.space_after = Pt(4)
p2 = c.add_paragraph()
r = p2.add_run("Does combining technical education with profession-specific communication practice "
               "better prepare learners to operate confidently in professional environments?")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(11); r.font.color.rgb = INK
p2.paragraph_format.space_before = Pt(0); p2.paragraph_format.space_after = Pt(0)
p2.paragraph_format.line_spacing = 1.35

# ---------------- page 3 ----------------
doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
gutter(doc, 10)
section_head(doc, "04", "Partnership Opportunities")
txt(doc, "Following a successful pilot, the model can grow in whichever direction suits the "
         "partner’s programmes.", size=10, after=8, line=1.4)
opts = [
    ("Student access", "Individual learner licences attached to technical programmes."),
    ("Cohort / institutional", "Access for classes, academies and training centres."),
    ("Bundled programmes", "BE Mastery included as the communication layer of a technical course."),
    ("Custom pathways", "Profession-specific scenarios aligned to partner curricula and learner needs."),
]
t, at = card_grid(doc, 2, 2)
for i, (a, b) in enumerate(opts):
    card(at(i // 2, i % 2), CARD2, a, b)
gutter(doc)

section_head(doc, "05", "Why This Partnership Matters")
t, at = card_grid(doc, 1, 3)
why = [
    ("01", "Technical training stays technical",
     "The partner keeps ownership of technical instruction, assessment and professional "
     "qualification.", CARD2, INK, BODY),
    ("02", "Communication becomes practice",
     "Learners rehearse the conversations they are likely to face around the workshop, the site "
     "and the interview table.", DARK, WHITE, RGBColor(0xCB, 0xC3, 0xF5)),
    ("03", "Progress becomes visible",
     "Speaking activity, practice history and coaching evidence let learners show how their "
     "communication has developed.", CARD2, INK, BODY),
]
for i, (n, a, b, fill, tc, bc) in enumerate(why):
    c = at(0, i)
    shade(c, fill); cell_margins(c, 140, 150, 140, 150)
    cell_border(c, "DDD9F5" if fill != DARK else DARK)
    p = c.paragraphs[0]; p.text = ""
    r = p.add_run(n)
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(15)
    r.font.color.rgb = ACCENT if fill != DARK else LILAC
    p.paragraph_format.space_after = Pt(2)
    p2 = c.add_paragraph()
    r = p2.add_run(a)
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(10); r.font.color.rgb = tc
    p2.paragraph_format.space_before = Pt(0); p2.paragraph_format.space_after = Pt(3)
    p2.paragraph_format.line_spacing = 1.2
    p3 = c.add_paragraph()
    r = p3.add_run(b)
    r.font.name = "Arial"; r.font.size = Pt(9); r.font.color.rgb = bc
    p3.paragraph_format.space_before = Pt(0); p3.paragraph_format.space_after = Pt(0)
    p3.paragraph_format.line_spacing = 1.32
gutter(doc)

section_head(doc, "06", "Scope, Integrity & Expansion")
txt(doc, "BE Mastery does not replace technical training, professional licensing, trade "
         "certification, immigration requirements or employer qualification processes. Its role is "
         "deliberately focused: professional English, workplace communication practice, and "
         "evidence of communication development.", size=10, after=8, line=1.42)
t = grid(doc, 1, 1, [CONTENT_W])
c = t.cell(0, 0); shade(c, GOLD); cell_margins(c, 140, 170, 140, 170)
cell_border(c, "F0DFB4")
p = c.paragraphs[0]; p.text = ""
r = p.add_run("EXPANSION POTENTIAL")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5)
r.font.color.rgb = RGBColor(0x8A, 0x63, 0x0B)
spacing(r, 30); p.paragraph_format.space_after = Pt(4)
p2 = c.add_paragraph()
r = p2.add_run("International Welder  →  Piping  →  Construction Supervision  →  "
               "QA/QC  →  Maintenance  →  Instrumentation  →  Energy & Industrial "
               "Operations")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = INK
p2.paragraph_format.space_before = Pt(0); p2.paragraph_format.space_after = Pt(0)
p2.paragraph_format.line_spacing = 1.35

gutter(doc, 12)
txt(doc, "Preparing technical professionals to communicate across workplaces, teams and borders.",
    size=10.5, colour=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER, before=8, after=10, italic=True)
bleed_image(doc, A / "footer.jpg")

normalise(doc)

cp = doc.core_properties
cp.title = "BE Mastery x Industrial Training Partner — Partnership Proposal"
cp.subject = "Professional English & Workplace Communication for Technical Careers"
cp.author = "Lomonec LLC"
cp.company = "Lomonec LLC"
cp.comments = "app.lomonec.com  ·  contact@lomonec.com"
cp.category = "Partnership proposal"

out = HERE / "BE-Mastery-Industrial-Training-Partnership-Proposal.docx"
doc.save(out)
print("%s  (%.0f KB)" % (out.name, out.stat().st_size / 1024))
