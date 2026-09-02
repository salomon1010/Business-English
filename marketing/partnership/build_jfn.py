#!/usr/bin/env python3
"""Pilot proposal for Petrocertif Construction Academy (jfn-academy.com).

Not a cold pitch. Their published course offer already names the app —
"Enhance your professional English skills … via our LomoneC App:
app.lomonec.com" — so the argument is that the promise exists and this makes it
real and measurable. Written to be forwarded: the champion is one partner among
several, and this document is what he shows the others.

Scoped deliberately to boilermaking / piping / welding supervision, because
those are the three trades BE Mastery already carries. Claiming the other six
disciplines would be claiming tracks that do not exist yet.
"""
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.shared import Cm, Pt, RGBColor

from docxkit import (A, ACCENT, BODY, CARD, CARD2, CONTENT_W, DARK, GAP, GOLD,
                     HERE, INK, LILAC, MINT, MUTED, ROSE, WHITE, bleed_image,
                     bullet, callout, card, card_grid, cell_border,
                     cell_margins, grid, gutter, new_document, normalise,
                     section_head, shade, spacing, txt)

AMBER_INK = RGBColor(0x8A, 0x63, 0x0B)
GREEN_INK = RGBColor(0x1D, 0x6B, 0x46)
LINK = RGBColor(0x3B, 0x2A, 0x9E)


def pagebreak(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    gutter(doc, 10)


def two_col_table(doc, headers, rows, split=0.44, size=9.5):
    t = grid(doc, len(rows) + 1, 2, [Cm(CONTENT_W.cm * split),
                                     Cm(CONTENT_W.cm * (1 - split))])
    for j, h in enumerate(headers):
        c = t.cell(0, j); shade(c, DARK); cell_margins(c, 100, 150, 100, 150)
        p = c.paragraphs[0]; p.text = ""
        r = p.add_run(h.upper())
        r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5)
        r.font.color.rgb = WHITE
        spacing(r, 26)
        p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
    for i, pair in enumerate(rows, start=1):
        for j, v in enumerate(pair):
            c = t.cell(i, j)
            shade(c, "FFFFFF" if i % 2 else "F6F5FD")
            cell_margins(c, 90, 150, 90, 150)
            cell_border(c, "E4E1F6", 4)
            p = c.paragraphs[0]; p.text = ""
            r = p.add_run(v)
            r.font.name = "Arial"; r.font.size = Pt(size)
            r.font.bold = (j == 0); r.font.color.rgb = INK if j == 0 else BODY
            p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.25
    return t


doc = new_document()
bleed_image(doc, A / "header-jfn.jpg")

# ---------------- page 1 ----------------
txt(doc, "Petrocertif Construction Academy already tells its learners they will strengthen their "
         "professional English through the LomoneC app. This proposal is about making that line "
         "true, visible and measured — starting with one cohort, at no cost, over four weeks.",
    size=10.4, before=13, after=6, line=1.38)

callout(doc, CARD, "D6D0F4", "Already in your published offer", ACCENT,
        [("“Enhance your professional English skills … and a shadowing approach via our LomoneC "
          "App: app.lomonec.com”", True),
         ("   — Petrocertif Construction Academy course offer. The app is live, free and already "
          "carries the welding, pipefitting and boilermaking trades. What is missing is evidence "
          "of what it does for your learners.", False)])
gutter(doc, 9)

section_head(doc, "01", "Why this matters for supervisors specifically")
txt(doc, "Your programmes train people to read the plan. On an international site, the supervisor "
         "is then the person who has to say it out loud: brief the crew from that drawing, raise "
         "a fit-up problem with the fabricator, discuss a weld-quality concern with an inspector, "
         "hand over a shift, and sit the interview that got them there in the first place.",
    size=10, after=6, line=1.4)
txt(doc, "Reading is taught. Saying it is not. That gap is what BE Mastery is built for.",
    size=10, bold=True, colour=INK, after=9, line=1.4)

feat = [
    ("Voice-first, not lessons",
     "12 workplace scenarios with a five-person cast — HR, supervisor, coworker, safety officer "
     "and QA inspector — talking in one conversation."),
    ("Measured against a real answer",
     "Every spoken answer is scored on what a competent answer needed: what was covered, what "
     "was missed, and the sentence that would have carried it."),
    ("Interview rehearsal",
     "12 interview coaches, each on one part of the professional story, plus destination "
     "guidance and a CV & LinkedIn coach."),
    ("Evidence, not attendance",
     "Answers spoken, coverage, best take, trade words actually used. Every figure comes from "
     "speech — nothing is scored from opening a screen."),
    ("Reaches your learners",
     "Instructions in 15 languages including French, works offline after first load, installs "
     "from the browser on Android and iPhone."),
    ("Free during the pilot",
     "No licence, no per-seat cost, no commitment beyond the four weeks. You supply the cohort; "
     "we supply the measurement."),
]
t, at = card_grid(doc, 3, 2)
for i, (a_, b_) in enumerate(feat):
    card(at(i // 2, i % 2), CARD2 if i < 4 else GOLD, a_, b_,
         border="DDD9F5" if i < 4 else "F0DFB4")

# ---------------- page 2 ----------------
pagebreak(doc)
section_head(doc, "02", "Where it fits your catalogue today")
txt(doc, "BE Mastery currently carries three trades: welder, pipefitter and boilermaker. Those "
         "map exactly onto three of your programmes, which is why the pilot is scoped to them "
         "rather than spread across the catalogue.",
    size=10, after=8, line=1.4)
two_col_table(doc, ("Your programme", "What the learner practises saying"), [
    ("Reading & Interpretation of Plans in Boiler Making",
     "Brief a crew from the drawing; clarify a detail with the fabricator"),
    ("Industrial Piping Supervisor",
     "Walk a contractor through an isometric and confirm the line is right"),
    ("Welding Production Supervision",
     "Discuss a weld-quality concern with a QA inspector; run a stop-work conversation"),
    ("Boiler & Pressure Vessel Equipment Supervisor",
     "Conduct a shift handover and a supervisor briefing"),
    ("Storage Tank Supervisor",
     "Run a toolbox talk; report a material or equipment problem"),
    ("All of the above",
     "Sit the supervisory interview before it counts, as often as they like"),
])
callout(doc, GOLD, "F0DFB4", "The expansion, if the pilot works", AMBER_INK,
        [("Electrical, civil, instrumentation, renewable energy and metal structures are not yet "
          "built as BE Mastery tracks. ", False),
         ("The pilot decides which one is built next, and Petrocertif chooses it.", True)])
gutter(doc, 9)

section_head(doc, "03", "The pilot — 20 to 30 learners, four weeks, free")
t, at = card_grid(doc, 1, 2)
c = at(0, 0)
shade(c, CARD2); cell_margins(c, 130, 160, 130, 160); cell_border(c)
p = c.paragraphs[0]; p.text = ""
r = p.add_run("PETROCERTIF PROVIDES")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = ACCENT
spacing(r, 30); p.paragraph_format.space_after = Pt(5)
for lead, rest in [("One cohort", " of 20–30 learners from the three programmes above"),
                   ("One induction slot", " of 20 minutes, to introduce the app"),
                   ("Instructor observations", " — what teaching staff notice in class"),
                   ("Permission", " to write up the result as a joint case study")]:
    bullet(c, lead, rest)
c.paragraphs[-1].paragraph_format.space_after = Pt(0)

c = at(0, 1)
shade(c, CARD2); cell_margins(c, 130, 160, 130, 160); cell_border(c)
p = c.paragraphs[0]; p.text = ""
r = p.add_run("BE MASTERY PROVIDES")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = ACCENT
spacing(r, 30); p.paragraph_format.space_after = Pt(5)
for lead, rest in [("Full access", " for every learner, free, for the pilot and 30 days after"),
                   ("Onboarding", " and a short guide in French and English"),
                   ("A weekly figure", " sent to you — no chasing required"),
                   ("A closing report", " you may show to anyone, and its underlying data")]:
    bullet(c, lead, rest)
c.paragraphs[-1].paragraph_format.space_after = Pt(0)
gutter(doc, 8)

two_col_table(doc, ("Week", "What happens"), [
    ("Week 1", "Induction, accounts created, first recorded answer captured as the baseline"),
    ("Weeks 2–3", "Learners practise in their own time — 25 minutes a day is the design target"),
    ("Week 4", "Interview simulations, closing measurement, learner and instructor feedback"),
    ("After", "Joint report. Nothing is published without Petrocertif's written approval"),
], split=0.20)

# ---------------- page 3 ----------------
pagebreak(doc)
section_head(doc, "04", "What we agree to measure")
txt(doc, "Success is agreed before the pilot starts, not argued about afterwards. Seven things, "
         "reported together:", size=10, after=8, line=1.4)
t = grid(doc, 1, 3, [Cm(CONTENT_W.cm * 0.5 - GAP.cm / 2), GAP,
                     Cm(CONTENT_W.cm * 0.5 - GAP.cm / 2)])
measures = [
    ("Activation", " — learners who start and finish setup"),
    ("Participation", " — learners active across the four weeks"),
    ("Speaking activities", " — workplace scenarios completed"),
    ("Recurring usage", " — learners returning week on week"),
    ("Learner feedback", " — confidence, and whether it felt useful"),
    ("Coverage change", " — first recorded answer against last"),
    ("Instructor observations", " — what your staff notice in class"),
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

callout(doc, MINT, "BFE0CE", "The one question the pilot answers", GREEN_INK,
        [("Does adding profession-specific spoken-English practice to a Petrocertif programme "
          "measurably improve how confidently a supervisor explains their work in English?", True)])
gutter(doc, 9)

section_head(doc, "05", "What each side gets out of it")
t, at = card_grid(doc, 1, 2)
card(at(0, 0), CARD, "Petrocertif Construction Academy",
     "The English line in your course offer stops being a promise and becomes an evidenced "
     "benefit, with a report you can show learners, employers and partners. First choice of "
     "which discipline is built next. No cost and no commitment.", border="D6D0F4")
card(at(0, 1), CARD, "Lomonec / BE Mastery",
     "The first measured cohort, and the evidence needed before approaching any other training "
     "organisation. Honest product feedback from instructors who know the trade.",
     border="D6D0F4")
gutter(doc, 9)

section_head(doc, "06", "Scope, integrity and data")
txt(doc, "BE Mastery does not replace technical training, professional licensing, trade "
         "certification, immigration requirements or employer qualification processes. Its role "
         "is deliberately narrow: professional English, workplace communication practice, and "
         "evidence of communication development.", size=10, after=7, line=1.4)
callout(doc, ROSE, "F2C9C9", "Two things to state plainly", RGBColor(0xA3, 0x2B, 0x2B),
        [("The certificate BE Mastery issues is a completion certificate for its 84-session "
          "programme. It is not a recognised English proficiency qualification, and the app does "
          "not assess written English. ", True),
         ("Recordings stay on the learner's own device; only the clip being scored is sent for "
          "transcription, and no learner personal data is shared with any third party. Both "
          "points are worth reflecting in the course page wording before the cohort starts.",
          False)])
gutter(doc, 10)

txt(doc, "One cohort. Four weeks. No cost, no licence discussion, and nothing published without "
         "your approval.", size=10.5, colour=MUTED, align=WD_ALIGN_PARAGRAPH.CENTER,
    before=6, after=10, italic=True)
bleed_image(doc, A / "footer.jpg")

normalise(doc)
cp = doc.core_properties
cp.title = "Petrocertif Construction Academy × BE Mastery — four-week pilot proposal"
cp.subject = "Professional English for supervisors in industrial and energy projects"
cp.author = "Lomonec LLC"
cp.company = "Lomonec LLC"
cp.category = "Pilot proposal"

out = HERE / "BE-Mastery-Petrocertif-Academy-Pilot-Proposal.docx"
doc.save(out)
print("%s  (%.0f KB)" % (out.name, out.stat().st_size / 1024))
