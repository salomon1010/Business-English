#!/usr/bin/env python3
"""Pilot playbook — how the four weeks actually run.

The proposal is the argument; this is the operating manual. It goes to the
academy once they say yes, and it is what stops a pilot drifting: named roles,
a dated schedule, the exact tools, and the forms as appendices so nobody has to
invent one in week three.
"""
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.shared import Cm, Pt, RGBColor

from docxkit import (A, ACCENT, BODY, CARD, CARD2, CONTENT_W, DARK, GAP, GOLD,
                     HERE, INK, LILAC, MINT, MUTED, ROSE, WHITE, bleed_image,
                     bullet, callout, card, card_grid, cell_border,
                     cell_margins, grid, gutter, new_document, normalise,
                     section_head, shade, spacing, txt)

PARTNER = "Petrocertif Construction Academy"
GREEN_INK = RGBColor(0x1D, 0x6B, 0x46)
ROSE_INK = RGBColor(0xA3, 0x2B, 0x2B)
AMBER_INK = RGBColor(0x8A, 0x63, 0x0B)


def pagebreak(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    gutter(doc, 10)


def table(doc, headers, rows, widths=None, size=9.5):
    w = widths or [Cm(CONTENT_W.cm / len(headers))] * len(headers)
    t = grid(doc, len(rows) + 1, len(headers), w)
    for j, h in enumerate(headers):
        c = t.cell(0, j); shade(c, DARK); cell_margins(c, 100, 150, 100, 150)
        p = c.paragraphs[0]; p.text = ""
        r = p.add_run(h.upper())
        r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5)
        r.font.color.rgb = WHITE
        spacing(r, 26)
        p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
    for i, row in enumerate(rows, start=1):
        for j, v in enumerate(row):
            c = t.cell(i, j)
            shade(c, "FFFFFF" if i % 2 else "F6F5FD")
            cell_margins(c, 90, 150, 90, 150)
            cell_border(c, "E4E1F6", 4)
            p = c.paragraphs[0]; p.text = ""
            r = p.add_run(v)
            r.font.name = "Arial"; r.font.size = Pt(size)
            r.font.bold = (j == 0); r.font.color.rgb = INK if j == 0 else BODY
            p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.24
    return t


def form_rows(doc, prompts, lines=1, widths=(0.52, 0.48)):
    """A printable form: prompt on the left, ruled space on the right."""
    t = grid(doc, len(prompts), 2, [Cm(CONTENT_W.cm * widths[0]),
                                    Cm(CONTENT_W.cm * widths[1])])
    for i, q in enumerate(prompts):
        c = t.cell(i, 0)
        shade(c, "F6F5FD" if i % 2 == 0 else "FFFFFF")
        cell_margins(c, 110, 150, 110, 150); cell_border(c, "E4E1F6", 4)
        p = c.paragraphs[0]; p.text = ""
        r = p.add_run(q)
        r.font.name = "Arial"; r.font.size = Pt(9.5); r.font.color.rgb = INK
        p.paragraph_format.space_before = Pt(0); p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.24
        c2 = t.cell(i, 1)
        shade(c2, "F6F5FD" if i % 2 == 0 else "FFFFFF")
        cell_margins(c2, 110, 150, 110, 150); cell_border(c2, "E4E1F6", 4)
        p = c2.paragraphs[0]; p.text = ""
        # one empty paragraph per writing line - runs of spaces on a single
        # paragraph add no height, leaving the forms too short to write on
        for k in range(lines):
            q = p if k == 0 else c2.add_paragraph()
            r = q.add_run(chr(160))
            r.font.name = "Arial"; r.font.size = Pt(10)
            q.paragraph_format.space_before = Pt(0)
            q.paragraph_format.space_after = Pt(3)
            q.paragraph_format.line_spacing = 1.6
    return t


doc = new_document()
bleed_image(doc, A / "header-playbook.jpg")

# ---------------- page 1 ----------------
txt(doc, "This is the operating manual for the pilot, not the proposal. It exists so that four "
         "weeks from now nobody is inventing a form, chasing a name, or arguing about what was "
         "supposed to be measured. Everything in it is agreed before week one starts.",
    size=10.4, before=13, after=8, line=1.38)

section_head(doc, "01", "Named roles — fill these in before day one")
txt(doc, "A pilot fails when a task belongs to an organisation rather than to a person. Four "
         "names, agreed in writing:", size=10, after=8, line=1.38)
table(doc, ("Role", "Who", "What they are on the hook for"), [
    ("Academy sponsor", "____________________",
     "Says yes, unblocks things, approves the final report before anyone sees it"),
    ("Cohort instructor", "____________________",
     "Knows the learners, gives 10 minutes in week 2 and week 4 for observations"),
    ("Pilot lead (Lomonec)", "____________________",
     "Onboarding, weekly figures, the closing report, all learner support"),
    ("Learner contact", "____________________",
     "One learner who will tell the truth about what is confusing"),
], widths=[Cm(CONTENT_W.cm * 0.24), Cm(CONTENT_W.cm * 0.26), Cm(CONTENT_W.cm * 0.50)])
gutter(doc, 9)

txt(doc, "Before day one — six things that must be true", size=12, bold=True, colour=INK,
    after=7, line=1.2)
t, at = card_grid(doc, 3, 2)
for i, (h, b) in enumerate([
        ("Cohort list agreed",
         "20–30 names from the boilermaking, piping or welding supervision programmes."),
        ("Four roles named",
         "Written down, with an email for each. A role without a name does not get done."),
        ("Induction slot booked",
         "20 minutes, with the learners in one place if possible. Everyone installs together."),
        ("Course-page wording checked",
         "The English promise on the site matches what the app actually does."),
        ("Learner guide sent",
         "In French and English, with the induction invitation, not after it."),
        ("Report approval agreed",
         "Who signs off the closing report, and how long they need.")]):
    card(at(i // 2, i % 2), CARD2, h, b)
pagebreak(doc)

section_head(doc, "02", "The four weeks")
table(doc, ("When", "Who", "What happens"), [
    ("Week 0 · setup", "Both",
     "Cohort list agreed. Roles named. Course-page wording checked. Learner guide sent."),
    ("Week 1 · day 1", "Lomonec",
     "20-minute induction, in person or on a call. Everyone installs together, takes the "
     "one-minute check, and records the first three Foundations sentences — the baseline."),
    ("Weeks 1–2", "Learners",
     "Foundations: three sentences a day, about fifteen minutes, French under every line. "
     "Learners who passed the check skip straight to stage 2."),
    ("Weeks 3–4", "Learners",
     "Workplace conversations and interview coaches. The same scenario is recorded in week 3 "
     "and again in week 4. A weekly figure goes to the sponsor every Monday."),
    ("Week 2 · midpoint", "Instructor",
     "Ten minutes: what have you noticed, and who has gone quiet?"),
    ("Week 4 · days 1–3", "Learners",
     "Closing measurement: the day-15 Foundations sentences re-recorded, and the week-3 "
     "scenario again for those who reached it."),
    ("Week 4 · day 5", "Both",
     "Learner survey and instructor observations collected."),
    ("Week 5", "Lomonec",
     "Draft report to the sponsor. Nothing is published without written approval."),
], widths=[Cm(CONTENT_W.cm * 0.20), Cm(CONTENT_W.cm * 0.16), Cm(CONTENT_W.cm * 0.64)])
callout(doc, MINT, "BFE0CE", "The one thing that cannot slip", GREEN_INK,
        [("The week-1 baseline. ", True),
         ("Three Foundations sentences recorded before any practice — for every learner, "
          "including those who pass the check. Without it there is no before-and-after and the "
          "pilot proves nothing. A learner who joins late still records a baseline first.", False)])

# ---------------- page 2 ----------------
pagebreak(doc)
section_head(doc, "03", "What a learner does")
txt(doc, "In their own time, on their own phone. No classroom, no timetable, nothing for the "
         "academy to schedule. Two stages, because the first cohort told us the app opened above "
         "their level:", size=10, after=8, line=1.38)
txt(doc, "Stage 1 · Foundations — about 15 minutes a day, weeks 1–2", size=11, bold=True,
    colour=INK, after=5, line=1.2)
table(doc, ("Step", "Activity", "What it builds"), [
    ("Hear", "Tap Hear, then Slow", "The sound of the sentence at two speeds"),
    ("Understand", "Read the French underneath", "Meaning first — nobody repeats what they cannot follow"),
    ("Say", "Shadow it out loud", "Rhythm and stress, by copying"),
    ("Record", "Record all three sentences", "The day's evidence, and a word score when online"),
], widths=[Cm(CONTENT_W.cm * 0.16), Cm(CONTENT_W.cm * 0.34), Cm(CONTENT_W.cm * 0.50)])
gutter(doc, 6)
txt(doc, "Stage 2 · The full programme — about 25 minutes a day, weeks 3–4", size=11, bold=True,
    colour=INK, after=5, line=1.2)
table(doc, ("Time", "Activity", "What it builds"), [
    ("5 min", "Shadowing", "Loop a short clip of a real speaker and copy the rhythm out loud"),
    ("10 min", "The day's session",
     "The prepared daily session — pronunciation, a speaking drill, or a meeting simulation"),
    ("7 min", "One workplace conversation",
     "Speak with the supervisor, the QA inspector or HR, and answer out loud"),
    ("3 min", "Read the report",
     "What was covered, what was missed, and the sentence that would have carried it"),
], widths=[Cm(CONTENT_W.cm * 0.13), Cm(CONTENT_W.cm * 0.31), Cm(CONTENT_W.cm * 0.56)])
txt(doc, "Learners who pass the one-minute check begin stage 2 in week 1. Once a week in stage 2 "
         "they should also run one interview coach — the activity closest to what they are "
         "preparing for.", size=9.5, colour=MUTED, before=6, after=9, line=1.38)

section_head(doc, "04", "Tools and documents — who gets what, and when")
table(doc, ("Document or tool", "Goes to", "When"), [
    ("Pilot proposal", "Sponsor and partners", "Before the decision"),
    ("This playbook", "Sponsor and instructor", "Week 0, once they say yes"),
    ("Learner guide (EN / FR)", "Every learner", "Week 0, with the induction invite"),
    ("The app — app.lomonec.com", "Every learner", "Week 1 induction, installed together"),
    ("Instructor observation sheet", "Cohort instructor", "Week 2 and week 4"),
    ("Learner feedback survey", "Every learner", "Week 4, day 5"),
    ("Weekly figure (one short email)", "Sponsor", "Every Monday, weeks 2–5"),
    ("Closing report", "Sponsor first, then anyone they allow", "Week 5"),
], widths=[Cm(CONTENT_W.cm * 0.38), Cm(CONTENT_W.cm * 0.32), Cm(CONTENT_W.cm * 0.30)])
pagebreak(doc)

section_head(doc, "05", "What we measure, and how")
table(doc, ("Measure", "How it is captured"), [
    ("Activation", "Learners who complete setup and record at least one answer"),
    ("Participation", "Learners active in each of the four weeks"),
    ("Speaking activities", "Count of workplace scenarios and interview coaches completed"),
    ("Recurring usage", "Learners returning in week 2, 3 and 4 — the honest retention number"),
    ("Progress through Foundations", "Days completed per learner, and how many reached stage 2"),
    ("Coverage change", "Baseline recording versus closing recording, learner by learner"),
    ("Learner feedback", "The week-4 survey in Appendix B"),
    ("Instructor observations", "The sheet in Appendix A, at midpoint and at the end"),
], widths=[Cm(CONTENT_W.cm * 0.30), Cm(CONTENT_W.cm * 0.70)])
callout(doc, ROSE, "F2C9C9", "Read before the numbers arrive", ROSE_INK,
        [("Some learners will not finish, and the report will say so. ", True),
         ("A pilot that reports honest attrition is worth more to both sides than one that "
          "quietly counts only the people who stayed — and it is the only kind either of us can "
          "show to a third party without being caught out.", False)])

section_head(doc, "06", "Ground rules")
t, at = card_grid(doc, 2, 2)
card(at(0, 0), CARD2, "Privacy",
     "Recordings stay on the learner's own device. Only the clip being scored is sent for "
     "transcription. No learner personal data is shared with any third party, and no recording "
     "is ever sent to the academy.")
card(at(0, 1), CARD2, "Publication",
     "Nothing is published, quoted or shown to another organisation without the sponsor's "
     "written approval — including the academy's name.")
card(at(1, 0), CARD2, "Support",
     "All learner support runs through the Lomonec pilot lead, not through academy staff. "
     "Instructors are asked for observations, not for help-desk duty.")
card(at(1, 1), CARD2, "Ending early",
     "Either side can stop the pilot at any point, for any reason, with no cost and no "
     "obligation. Learners keep their access for 30 days afterwards regardless.")
pagebreak(doc)

section_head(doc, "A", "Appendix A · Instructor observation sheet")
txt(doc, "Ten minutes, twice: once at the midpoint of week 2, once at the end of week 4. Written "
         "by the cohort instructor, in whichever language they prefer.",
    size=9.5, colour=MUTED, after=8, line=1.35)
form_rows(doc, [
    "Cohort / programme, and date of this observation",
    "Have you heard any learner mention the app unprompted? What did they say?",
    "Has anyone's spoken English noticeably changed in class? Who, and how?",
    "Who has gone quiet, and do you know why?",
    "What is confusing learners, or what are they complaining about?",
    "Anything a learner asked for that does not exist yet?",
    "Would you keep this in the programme? What would have to change first?",
], lines=4)

# ---------------- page 4 ----------------
pagebreak(doc)
section_head(doc, "B", "Appendix B · Learner feedback survey")
txt(doc, "Week 4, day 5. Six questions, answered anonymously. English or French.",
    size=9.5, colour=MUTED, after=8, line=1.35)
table(doc, ("Question", "Scale"), [
    ("I used the app in a normal week", "Never · 1–2 days · 3–4 days · 5+ days"),
    ("Speaking English at work feels easier than four weeks ago", "1 to 5"),
    ("The feedback told me something I did not already know", "1 to 5"),
    ("I would keep using it after the pilot", "Yes · No · Not sure"),
    ("I would recommend it to a colleague", "1 to 5"),
], widths=[Cm(CONTENT_W.cm * 0.62), Cm(CONTENT_W.cm * 0.38)])
gutter(doc, 6)
form_rows(doc, [
    "What stopped you using it more often?",
    "What would you change first?",
], lines=3)
gutter(doc, 9)

section_head(doc, "C", "Appendix C · Baseline and closing measurement")
txt(doc, "The same task, twice, four weeks apart — this is the only comparison in the pilot that "
         "shows movement in an individual learner rather than usage of an app.",
    size=10, after=8, line=1.38)
table(doc, ("Step", "What happens"), [
    ("1 · Same sentences",
     "Every learner records the three day-1 Foundations sentences on induction day, before any "
     "practice, and records them again in week 4. Same words, four weeks apart"),
    ("2 · Same scenario, stage 2",
     "Learners who reach the workplace conversations run the same scenario in week 3 and again "
     "in week 4"),
    ("3 · Recorded by the app",
     "Word scores for the sentences; coverage, points covered and missed for the scenario — "
     "captured automatically, offline-safe"),
    ("4 · Compared per learner",
     "First recording against last, learner by learner — not a cohort average hiding the spread"),
    ("5 · Reported with attrition",
     "Learners who did not complete both recordings are reported as such, never dropped"),
], widths=[Cm(CONTENT_W.cm * 0.28), Cm(CONTENT_W.cm * 0.72)])
callout(doc, GOLD, "F0DFB4", "What this measurement is and is not", AMBER_INK,
        [("It measures how completely someone explained themselves in English against a model "
          "answer. ", False),
         ("It is not a language proficiency test, not a CEFR level, and not evidence of trade "
          "competence.", True)])
gutter(doc, 10)
bleed_image(doc, A / "footer.jpg")

normalise(doc)
cp = doc.core_properties
cp.title = "Pilot playbook — %s × BE Mastery" % PARTNER
cp.subject = "Roles, schedule, tools and measurement for the four-week pilot"
cp.author = "Lomonec LLC"
cp.company = "Lomonec LLC"
cp.category = "Pilot playbook"

out = HERE / "BE-Mastery-Pilot-Playbook.docx"
doc.save(out)
print("%s  (%.0f KB)" % (out.name, out.stat().st_size / 1024))
