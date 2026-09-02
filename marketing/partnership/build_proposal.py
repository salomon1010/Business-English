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
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.shared import Cm, Pt, RGBColor

from docxkit import (A, ACCENT, BODY, CARD, CARD2, CONTENT_W, DARK, GAP, GOLD,
                     HERE, INK, LILAC, MARGIN, MINT, MUTED, PAGE_W, WHITE,
                     bleed_image, bullet, card, card_grid, cell_border,
                     cell_margins, eyebrow, grid, gutter, normalise, para_rule,
                     section_head, shade, spacing, txt, new_document)

# =========================== the document ===========================
doc = new_document()

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
