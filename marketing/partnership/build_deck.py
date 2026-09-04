#!/usr/bin/env python3
"""Pilot presentation — Petrocertif Construction Academy x BE Mastery.

Eighteen slides for a twenty-minute meeting, every slide carrying its own
speaker notes so the deck can be rehearsed from inside PowerPoint. Built to be
reused: change PARTNER and the three programme names and it presents to any
other training organisation.

  python3 deck_assets.py && python3 build_deck.py
"""
import pathlib
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

from deckkit import (A, ACCENT, BODY, GREEN, H, HERE, INK, LILAC, M, MUTED,
                     PALE, W, WHITE, card, card_text, eyebrow, footer, heading,
                     new_deck, para, rule, slide, tb)

PARTNER = "Petrocertif Construction Academy"
PARTNER_SHORT = "Petrocertif"

prs = new_deck()

# ═══════════════════════════ 1 · title ═══════════════════════════
s = slide(prs, "deck-title.jpg", notes=(
    "Open by naming the two things you want from this meeting, so nothing is a surprise:\n\n"
    "\"Two things today. First, I want to propose a pilot — one cohort, four weeks, free. "
    "Second, and honestly: this is the first time I present this properly, and I want you to "
    "tell me where it is weak, because I am taking the same presentation to academies in "
    "Ghana, Nigeria, Kenya and Canada.\"\n\n"
    "Then move on. Do not dwell on it — it buys goodwill, it is not the subject."))
tf = tb(s, M, Inches(2.35), Inches(10.6), Inches(2.6))
para(tf, "FOUR-WEEK PILOT PROPOSAL", 13, True, LILAC, 20, first=True)
para(tf, "%s\n× BE Mastery" % PARTNER, 44, True, WHITE, 16, line=1.06)
para(tf, "Professional English for supervisors in industrial and energy projects",
     17, False, PALE, 0)

# ═══════════════════════════ 2 · agenda ═══════════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "Say the running order out loud and give the time. People relax when they know how long "
    "something will take.\n\n"
    "\"Twenty minutes. Five on the problem, five on the tool, ten on how the pilot actually "
    "runs. The only decision I am asking for today is whether you want one cohort to try it.\""))
eyebrow(s, "Agenda")
heading(s, "Twenty minutes, four parts")
rule(s, Inches(2.15))
items = [
    ("01", "The gap your programmes leave open", "Five minutes. Reading a plan and explaining "
     "it are different skills. Only one of them is taught."),
    ("02", "What BE Mastery does about it", "Five minutes, on screen. Not slides of features — "
     "the actual product."),
    ("03", "How the pilot runs", "Ten minutes. Who does what, what a learner does each day, "
     "what we measure, over four weeks."),
    ("04", "What I am asking for", "One minute. One cohort. Free. No licence discussion today."),
]
y = Inches(2.62)
for n, t, b in items:
    tf = tb(s, M, y, Inches(0.9), Inches(0.8))
    para(tf, n, 26, True, ACCENT, 0, first=True)
    tf = tb(s, M + Inches(1.0), y - Inches(0.03), Inches(10.4), Inches(0.9))
    para(tf, t, 17, True, INK, 3, first=True)
    para(tf, b, 12.5, False, MUTED, 0, line=1.25)
    y += Inches(1.02)
footer(s)

# ═══════════════════════════ 3 · the gap ═══════════════════════════
s = slide(prs, "deck-dark-left.jpg", notes=(
    "This is the whole argument. Say it slowly and then stop talking.\n\n"
    "\"Your courses teach someone to read an isometric, a P&ID, a metal-structure drawing. "
    "That is real skill and it is what they pay you for. But on an international site the "
    "supervisor is the person who has to open their mouth: brief the crew from that drawing, "
    "tell the fabricator the fit-up is wrong, explain a weld-quality concern to an inspector, "
    "hand over a shift.\"\n\n"
    "Then the line that matters: \"Reading is taught. Saying it is not.\" Pause. Let him agree "
    "or push back — either is useful."))
tf = tb(s, M, Inches(2.05), Inches(10.4), Inches(3.75))
para(tf, "THE GAP", 13, True, LILAC, 22, first=True)
para(tf, "Your programmes teach people to read the plan.", 33, True, WHITE, 8, line=1.12)
para(tf, "On site, the supervisor is the one who has to say it.", 33, True, LILAC, 24, line=1.12)
para(tf, "Brief the crew from the drawing  ·  tell the fabricator the fit-up is wrong  ·  "
         "discuss a weld-quality concern with an inspector  ·  hand over a shift  ·  "
         "sit the interview that got them there", 14, False, PALE, 0, line=1.4)
footer(s, dark=True)

# ═══════════════════════════ 4 · their own promise ═══════════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "This is the slide that makes the meeting easy, and it is his own copy, so it cannot be "
    "argued with.\n\n"
    "\"You already tell your learners this. It is on your course page today. I am not asking "
    "you to add something new — I am asking to make a line you have already published true, "
    "and to prove it with numbers.\"\n\n"
    "Do not say it accusingly. He wrote it because he believed it. The point is that it is "
    "currently a promise with no evidence behind it, and that is fixable in four weeks."))
eyebrow(s, "You have already promised this")
heading(s, "This line is on your course page today", size=30)
rule(s, Inches(2.05))
c = card(s, M, Inches(2.5), Inches(11.6), Inches(1.7),
         fill=RGBColor(0xEF, 0xED, 0xFB), line=RGBColor(0xD6, 0xD0, 0xF4))
tf = tb(s, M + Inches(0.42), Inches(2.78), Inches(10.8), Inches(1.2))
para(tf, "“Enhance your professional English skills, with certification in written and spoken "
         "English and a shadowing approach via our LomoneC App — app.lomonec.com”",
     17, True, INK, 6, first=True, line=1.3)
para(tf, "— %s, published course offer" % PARTNER, 12, False, MUTED, 0)
tf = tb(s, M, Inches(4.55), Inches(11.6), Inches(1.6))
para(tf, "The app is live, free, and already carries welder, pipefitter and boilermaker.",
     18, True, INK, 8, first=True)
para(tf, "What is missing is evidence of what it does for your learners. That is exactly what "
         "a four-week pilot produces — and it costs you nothing but one cohort.",
     15, False, BODY, 0, line=1.35)
footer(s)

# ═══════════════════════ 5–9 · the product, on screen ═══════════════════════
PRODUCT = [
    ("phone-scenarios.png", "The workplace, not a lesson",
     "Twelve workplace scenarios",
     [("A five-person cast", " — HR, supervisor, coworker, safety officer and QA inspector, "
       "talking in one conversation."),
      ("First day to final briefing", " — the scenarios follow the shape of a real job, not a "
       "syllabus."),
      ("Spoken, not typed", " — the learner answers out loud, as often as they like.")],
     "Show, do not describe. If you have signal, open the app on your phone and hand it to him.\n\n"
     "\"These are the conversations a supervisor actually has. He picks one, and the crew talks "
     "to him — HR, the supervisor, the tool room, safety, QA. Not one voice. The whole room, in "
     "one conversation.\""),
    ("phone-conversation.png", "How it feels to use",
     "You speak. They answer back.",
     [("Voice-first", " — the learner talks; there is no typing and no multiple choice."),
      ("It keeps going", " — lose the network mid-interview and the conversation continues down "
       "its question list."),
      ("Repeatable", " — the same scenario can be run again tomorrow, and the score moves.")],
     "\"There is no typing anywhere in this. He talks, they answer, it goes where the "
     "conversation goes. And if the network drops in the middle — which it will — it keeps "
     "running.\"\n\n"
     "If he asks about data cost: the conversation is text, the scoring is a short clip. It is "
     "small. Be honest that Executive Polish and scoring need internet; the rest works offline."),
    ("phone-report.png", "The part that changes behaviour",
     "A report that names the gap",
     [("What you said", " — his own words, written back to him."),
      ("What a competent answer needed", " — which points he covered, which he missed."),
      ("The sentence he should have said", " — not a correction, a model to say back.")],
     "SLOW DOWN HERE. This is the money slide and the thing nobody else does.\n\n"
     "\"A score tells you that you failed. This tells you what was missing and gives you the "
     "sentence that would have carried it. Then the person who asked the question reads it back "
     "to you, so you hear it before you say it.\"\n\n"
     "If he only remembers one slide, make it this one."),
    ("phone-coaches.png", "Before it counts",
     "Twelve interview coaches",
     [("One part of the story each", " — introduction, teamwork, safety, equipment, quality."),
      ("Repeat any of them", " — as often as they like, no appointment, no tutor."),
      ("Plus a CV and LinkedIn coach", " — the summary rewritten to read professionally.")],
     "\"Your learners finish the technical training and then meet a recruiter who decides in "
     "ninety seconds. This is where they get to have that conversation twenty times first.\"\n\n"
     "Tie it back to his own offer — his page already mentions LinkedIn support. This is the "
     "practice that makes that support worth something."),
    ("phone-career.png", "Something to show",
     "Evidence, not attendance",
     [("Answers spoken, coverage, best take", " — and the trade words actually used."),
      ("Every figure from speech", " — nothing is scored from opening a screen."),
      ("Per learner", " — which is what makes a pilot measurable at all.")],
     "\"This is the part that matters to you as an academy, not just to the learner. At the end "
     "of four weeks I can tell you what actually happened — how many spoke, how often, and "
     "whether their answers got more complete. Not how many logged in.\"\n\n"
     "This slide is the bridge into the pilot half of the meeting."),
]
for img, eb, head, rows, notes in PRODUCT:
    s = slide(prs, "deck-light.jpg", notes=notes)
    eyebrow(s, eb)
    heading(s, head, size=31, w=Inches(7.0))
    rule(s, Inches(2.12))
    y = Inches(2.62)
    for lead, rest in rows:
        c = card(s, M, y, Inches(6.9), Inches(1.12))
        tf = tb(s, M + Inches(0.3), y + Inches(0.2), Inches(6.3), Inches(0.8))
        p = para(tf, "", 13.5, False, BODY, 0, first=True, line=1.3)
        r = p.add_run(); r.text = lead
        r.font.name = "Arial"; r.font.size = Pt(13.5); r.font.bold = True
        r.font.color.rgb = INK
        r = p.add_run(); r.text = rest
        r.font.name = "Arial"; r.font.size = Pt(13.5); r.font.color.rgb = BODY
        y += Inches(1.28)
    s.shapes.add_picture(str(A / img), Inches(8.35), Inches(1.06), height=Inches(5.6))
    footer(s)

# ═══════════════════════ 10 · where it fits ═══════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "Be straight about the limit before he finds it himself. This builds more trust than any "
    "feature slide.\n\n"
    "\"BE Mastery carries three trades today: welder, pipefitter, boilermaker. Those map onto "
    "three of your programmes exactly. Your other six — electrical, civil, instrumentation, "
    "renewable, metal structures, storage tanks — are not built yet. I am not going to pretend "
    "they are.\"\n\n"
    "Then the upside: \"The pilot decides which one gets built next, and you choose it.\" That "
    "turns a limitation into his decision."))
eyebrow(s, "Being straight about the limit")
heading(s, "Where it fits your catalogue today", size=31)
rule(s, Inches(2.12))
rowsy = Inches(2.6)
hdr = card(s, M, rowsy, Inches(11.6), Inches(0.52), fill=INK, line=INK)
tf = tb(s, M + Inches(0.3), rowsy + Inches(0.13), Inches(5.0), Inches(0.3))
para(tf, "YOUR PROGRAMME", 11, True, WHITE, 0, first=True)
tf = tb(s, M + Inches(5.4), rowsy + Inches(0.13), Inches(6.0), Inches(0.3))
para(tf, "WHAT THE LEARNER PRACTISES SAYING", 11, True, WHITE, 0, first=True)
maps = [
    ("Reading & Interpretation of Plans in Boiler Making",
     "Brief a crew from the drawing; clarify a detail with the fabricator"),
    ("Industrial Piping Supervisor",
     "Walk a contractor through an isometric and confirm the line is right"),
    ("Welding Production Supervision",
     "Discuss a weld-quality concern with a QA inspector; run a stop-work conversation"),
]
y = rowsy + Inches(0.52)
for i, (a_, b_) in enumerate(maps):
    fill = RGBColor(0xFF, 0xFF, 0xFF) if i % 2 == 0 else RGBColor(0xF6, 0xF5, 0xFD)
    card(s, M, y, Inches(11.6), Inches(0.72), fill=fill,
         line=RGBColor(0xE4, 0xE1, 0xF6))
    tf = tb(s, M + Inches(0.3), y + Inches(0.2), Inches(5.0), Inches(0.4))
    para(tf, a_, 13, True, INK, 0, first=True, line=1.15)
    tf = tb(s, M + Inches(5.4), y + Inches(0.2), Inches(6.0), Inches(0.4))
    para(tf, b_, 13, False, BODY, 0, first=True, line=1.15)
    y += Inches(0.72)
c = card(s, M, y + Inches(0.34), Inches(11.6), Inches(1.05),
         fill=RGBColor(0xFF, 0xF7, 0xE3), line=RGBColor(0xF0, 0xDF, 0xB4))
tf = tb(s, M + Inches(0.32), y + Inches(0.52), Inches(11.0), Inches(0.8))
para(tf, "NOT YET BUILT", 11, True, RGBColor(0x8A, 0x63, 0x0B), 4, first=True)
para(tf, "Electrical, civil, instrumentation, renewable energy, metal structures, storage "
         "tanks. The pilot decides which one is built next — and you choose it.",
     13.5, True, INK, 0, line=1.25)
footer(s)

# ═══════════════════════ 11 · the pilot ═══════════════════════
s = slide(prs, "deck-dark.jpg", notes=(
    "Say the whole ask in one breath, then stop.\n\n"
    "\"One cohort. Twenty to thirty of your learners from those three programmes. Four weeks. "
    "Free — no licence, no per-seat cost, no commitment after it ends. You give me the cohort "
    "and twenty minutes to introduce it. I do everything else, including the measuring.\"\n\n"
    "Then: \"Nothing gets published without your written approval.\" Say that unprompted. It is "
    "the sentence that makes a partner comfortable."))
tf = tb(s, M, Inches(1.5), Inches(11), Inches(1.2))
para(tf, "THE PROPOSAL", 13, True, LILAC, 14, first=True)
para(tf, "One cohort. Four weeks. Free.", 40, True, WHITE, 0, line=1.05)
stats = [("20–30", "learners"), ("4", "weeks"), ("1", "pathway"), ("$0", "cost to you")]
x = M
for big, lab in stats:
    c = card(s, x, Inches(3.35), Inches(2.66), Inches(1.5),
             fill=RGBColor(0x3A, 0x2C, 0x78), line=RGBColor(0x6B, 0x59, 0xC4))
    tf = tb(s, x, Inches(3.58), Inches(2.66), Inches(0.7))
    para(tf, big, 32, True, LILAC, 2, first=True, align=PP_ALIGN.CENTER)
    tf = tb(s, x, Inches(4.28), Inches(2.66), Inches(0.35))
    para(tf, lab.upper(), 11.5, True, WHITE, 0, first=True, align=PP_ALIGN.CENTER)
    x += Inches(2.96)
tf = tb(s, M, Inches(5.28), Inches(11.6), Inches(1.2))
para(tf, "Nothing is published without your written approval. No licence discussion until the "
         "pilot has produced a result we both believe.", 16, False, PALE, 0, first=True,
     line=1.35)
footer(s, dark=True)

# ═══════════════════════ 12 · who does what ═══════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "Read the left column slowly — it is short on purpose, and it is the part he is buying.\n\n"
    "\"Your side is four things, and three of them take an hour in total. My side is everything "
    "else.\"\n\n"
    "The one that needs a real commitment is the instructor observations. Ask directly: \"Which "
    "instructor would be the one to notice? Can I have ten minutes of their time in week two "
    "and week four?\" Getting a name here is the difference between a pilot that happens and "
    "one that drifts."))
eyebrow(s, "How it runs")
heading(s, "Who does what", size=32)
rule(s, Inches(2.12))
cols = [
    ("PETROCERTIF PROVIDES", RGBColor(0xEF, 0xED, 0xFB), RGBColor(0xD6, 0xD0, 0xF4), [
        ("One cohort", "20–30 learners from the three programmes"),
        ("One induction slot", "20 minutes, to introduce the app"),
        ("Instructor observations", "what your staff notice in class"),
        ("Permission", "to write the result up jointly")]),
    ("BE MASTERY PROVIDES", RGBColor(0xF6, 0xF5, 0xFD), RGBColor(0xDD, 0xD9, 0xF5), [
        ("Full access", "every learner, free, pilot plus 30 days"),
        ("Onboarding", "a short guide in French and English"),
        ("A weekly figure", "sent to you — no chasing required"),
        ("A closing report", "yours to show, with its underlying data")]),
]
x = M
for title, fill, line, rows in cols:
    card(s, x, Inches(2.6), Inches(5.6), Inches(3.55), fill=fill, line=line)
    tf = tb(s, x + Inches(0.32), Inches(2.82), Inches(5.0), Inches(0.3))
    para(tf, title, 11.5, True, ACCENT, 0, first=True)
    yy = Inches(3.25)
    for lead, rest in rows:
        tf = tb(s, x + Inches(0.32), yy, Inches(4.96), Inches(0.62))
        p = para(tf, "", 13, False, BODY, 0, first=True, line=1.25)
        r = p.add_run(); r.text = "✓  "
        r.font.name = "Arial"; r.font.size = Pt(13); r.font.bold = True
        r.font.color.rgb = ACCENT
        r = p.add_run(); r.text = lead + " — "
        r.font.name = "Arial"; r.font.size = Pt(13); r.font.bold = True; r.font.color.rgb = INK
        r = p.add_run(); r.text = rest
        r.font.name = "Arial"; r.font.size = Pt(13); r.font.color.rgb = BODY
        yy += Inches(0.7)
    x += Inches(6.0)
footer(s)

# ═══════════════════════ 13 · what a learner does ═══════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "He will ask this, so answer it before he does. Be concrete — a training director thinks in "
    "contact hours.\n\n"
    "\"Twenty-five minutes a day, in their own time, on their own phone. Not a class, not a "
    "timetable. Four things: warm up by shadowing a real speaker, do the day's session, run one "
    "workplace conversation, then read the report on what they missed. Roughly ten hours across "
    "the four weeks.\"\n\n"
    "If he pushes on whether they will actually do it: be honest. Some will not. That is exactly "
    "what activation and weekly-return numbers are for, and it is why the pilot is worth running."))
eyebrow(s, "What a learner actually does")
heading(s, "Twenty-five minutes a day, on their own phone", size=29)
rule(s, Inches(2.12))
acts = [
    ("5 min", "Shadow", "Loop a short clip of a real speaker and copy the rhythm out loud."),
    ("10 min", "Today's session", "The prepared daily session — pronunciation, a speaking "
     "drill, or a meeting simulation."),
    ("7 min", "One workplace conversation", "Speak with the supervisor, the inspector or HR — "
     "and answer out loud."),
    ("3 min", "Read the report", "What was covered, what was missed, and the sentence that "
     "would have carried it."),
]
y = Inches(2.5)
for t_, name, desc in acts:
    card(s, M, y, Inches(11.6), Inches(0.88))
    tf = tb(s, M + Inches(0.3), y + Inches(0.22), Inches(1.3), Inches(0.45))
    para(tf, t_, 17, True, ACCENT, 0, first=True)
    tf = tb(s, M + Inches(1.75), y + Inches(0.12), Inches(3.1), Inches(0.6))
    para(tf, name, 14.5, True, INK, 0, first=True, line=1.15)
    tf = tb(s, M + Inches(4.85), y + Inches(0.18), Inches(6.5), Inches(0.6))
    para(tf, desc, 13, False, BODY, 0, first=True, line=1.25)
    y += Inches(0.99)
tf = tb(s, M, Inches(6.42), Inches(11.6), Inches(0.4))
para(tf, "About 10 hours across the four weeks — in their own time, no timetable, no classroom.",
     13.5, True, MUTED, 0, first=True)
footer(s)

# ═══════════════════════ 14 · the four weeks ═══════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "Keep this short — it is a reassurance slide, not a content slide.\n\n"
    "\"Week one we set them up and capture a baseline: their first recorded answer, before any "
    "practice. Weeks two and three they just use it. Week four they run the interview "
    "simulations and we measure the same thing again, so there is a before and an after from "
    "the same person.\"\n\n"
    "The baseline is the bit that makes the whole pilot credible. Do not let week one slip."))
eyebrow(s, "The four weeks")
heading(s, "Baseline, practice, measure again", size=32)
rule(s, Inches(2.12))
weeks = [
    ("WEEK 1", "Set up and baseline", "Induction, accounts created, and every learner records "
     "one answer before any practice. That recording is the before."),
    ("WEEKS 2–3", "Practice", "Learners work in their own time. A weekly figure comes to you. "
     "I chase nobody through you."),
    ("WEEK 4", "Measure again", "Interview simulations, the same measurement as week one, plus "
     "learner and instructor feedback."),
    ("AFTER", "Joint report", "Written up together. Nothing published without your written "
     "approval."),
]
x = M
for eb, t_, d in weeks:
    card(s, x, Inches(2.65), Inches(2.72), Inches(3.3))
    tf = tb(s, x + Inches(0.26), Inches(2.88), Inches(2.3), Inches(0.3))
    para(tf, eb, 11.5, True, ACCENT, 0, first=True)
    tf = tb(s, x + Inches(0.26), Inches(3.25), Inches(2.3), Inches(0.7))
    para(tf, t_, 15, True, INK, 0, first=True, line=1.12)
    tf = tb(s, x + Inches(0.26), Inches(4.05), Inches(2.3), Inches(1.7))
    para(tf, d, 12, False, BODY, 0, first=True, line=1.3)
    x += Inches(2.92)
footer(s)

# ═══════════════════════ 15 · what we measure ═══════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "\"Success is agreed before we start, not argued about afterwards. Seven numbers. If you "
    "want to add one, add it now — that is much better than discovering in week four that we "
    "were measuring different things.\"\n\n"
    "Genuinely invite him to add one. An institution that helps define the measure believes the "
    "result."))
eyebrow(s, "Agreed before we start, not after")
heading(s, "The seven things we report", size=32)
rule(s, Inches(2.12))
meas = [
    ("Activation", "learners who start and finish setup"),
    ("Participation", "learners active across the four weeks"),
    ("Speaking activities", "workplace scenarios completed"),
    ("Recurring usage", "learners returning week on week"),
    ("Learner feedback", "confidence, and whether it felt useful"),
    ("Coverage change", "first recorded answer against last"),
    ("Instructor observations", "what your staff notice in class"),
]
x, y = M, Inches(2.6)
for i, (a_, b_) in enumerate(meas):
    card(s, x, y, Inches(5.6), Inches(0.86))
    tf = tb(s, x + Inches(0.3), y + Inches(0.15), Inches(5.0), Inches(0.6))
    para(tf, a_, 14, True, INK, 2, first=True, line=1.1)
    para(tf, b_, 12, False, MUTED, 0, line=1.15)
    if i % 2 == 0:
        x += Inches(6.0)
    else:
        x = M; y += Inches(0.98)
c = card(s, M + Inches(6.0), y, Inches(5.6), Inches(0.86),
         fill=RGBColor(0xEA, 0xF6, 0xF0), line=RGBColor(0xBF, 0xE0, 0xCE))
tf = tb(s, M + Inches(6.3), y + Inches(0.15), Inches(5.0), Inches(0.6))
para(tf, "Want an eighth?", 14, True, GREEN, 2, first=True, line=1.1)
para(tf, "Add it now, not in week four.", 12, False, GREEN, 0, line=1.15)
footer(s)

# ═══════════════════════ 16 · what this is not ═══════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "Do not skip this. Saying it yourself, before he asks, is what separates a partner from a "
    "vendor.\n\n"
    "\"Three things this is not. It is not a trade qualification. It is not a recognised English "
    "proficiency certificate — the certificate the app issues is a completion certificate for "
    "its own programme, and it does not test written English at all. And it does not replace "
    "anything you teach.\"\n\n"
    "Then raise the wording, gently and privately if you prefer: his course page currently says "
    "'certification in written and spoken English'. If a learner enrols expecting that, the "
    "complaint lands on his academy, not on you. Offer the replacement sentence from the "
    "proposal. This will be remembered."))
eyebrow(s, "Scope and integrity", colour=RGBColor(0xA3, 0x2B, 0x2B))
heading(s, "What this is not", size=32)
rule(s, Inches(2.12), colour=RGBColor(0xA3, 0x2B, 0x2B))
nots = [
    ("Not a trade qualification",
     "It does not certify that anyone can weld, and never claims to. AWS, ASME, IIW and your "
     "own assessments are untouched."),
    ("Not an English proficiency certificate",
     "The certificate is for completing the app's own 84-session programme. It is not IELTS, "
     "not a CEFR level, and written English is not assessed at all."),
    ("Not a replacement for your teaching",
     "It is one layer on top of your programme: professional English, workplace communication "
     "practice, and evidence of both."),
]
y = Inches(2.6)
for t_, d in nots:
    card(s, M, y, Inches(11.6), Inches(1.18), fill=RGBColor(0xFD, 0xEE, 0xEE),
         line=RGBColor(0xF2, 0xC9, 0xC9))
    tf = tb(s, M + Inches(0.34), y + Inches(0.22), Inches(11.0), Inches(0.85))
    para(tf, t_, 15, True, INK, 3, first=True, line=1.1)
    para(tf, d, 12.5, False, BODY, 0, line=1.28)
    y += Inches(1.32)
tf = tb(s, M, Inches(6.5), Inches(11.6), Inches(0.5))
para(tf, "Worth reflecting in the course page wording before the cohort starts — a suggested "
         "sentence is in the proposal.", 12.5, True, MUTED, 0, first=True)
footer(s)

# ═══════════════════════ 17 · what each side gets ═══════════════════════
s = slide(prs, "deck-light.jpg", notes=(
    "Say his side first and mean it. Then be honest about yours — it is disarming, and he "
    "already knows.\n\n"
    "\"For you: the English line on your page stops being a promise and becomes something you "
    "can show, with a report and first choice of which discipline gets built next. For me: this "
    "is the evidence I need before I approach anyone else. I am not pretending otherwise — you "
    "are the first, and that is why you get to shape it.\""))
eyebrow(s, "Both sides")
heading(s, "What each of us gets out of it", size=32)
rule(s, Inches(2.12))
sides = [
    (PARTNER, RGBColor(0xEF, 0xED, 0xFB), RGBColor(0xD6, 0xD0, 0xF4), [
        "The English line in your offer becomes an evidenced benefit, not a promise.",
        "A report you can show learners, employers and partners.",
        "First choice of which discipline gets built next.",
        "No cost, no licence, no commitment."]),
    ("Lomonec / BE Mastery", RGBColor(0xF6, 0xF5, 0xFD), RGBColor(0xDD, 0xD9, 0xF5), [
        "The first measured cohort — the evidence needed before approaching anyone else.",
        "Honest product feedback from instructors who know the trade.",
        "A reference, if and only if you are happy to be one."]),
]
x = M
for title, fill, line, rows in sides:
    card(s, x, Inches(2.6), Inches(5.6), Inches(3.5), fill=fill, line=line)
    tf = tb(s, x + Inches(0.32), Inches(2.84), Inches(5.0), Inches(0.4))
    para(tf, title, 15, True, INK, 0, first=True, line=1.1)
    yy = Inches(3.42)
    for r_ in rows:
        tf = tb(s, x + Inches(0.32), yy, Inches(4.96), Inches(0.7))
        p = para(tf, "", 12.5, False, BODY, 0, first=True, line=1.28)
        run = p.add_run(); run.text = "·  "
        run.font.name = "Arial"; run.font.size = Pt(12.5); run.font.bold = True
        run.font.color.rgb = ACCENT
        run = p.add_run(); run.text = r_
        run.font.name = "Arial"; run.font.size = Pt(12.5); run.font.color.rgb = BODY
        yy += Inches(0.62)
    x += Inches(6.0)
footer(s)

# ═══════════════════════ 18 · the ask ═══════════════════════
s = slide(prs, "deck-dark.jpg", notes=(
    "End on the smallest possible yes, and then be quiet. Do not fill the silence.\n\n"
    "\"So: one cohort, four weeks, free. If you say yes today, week one can start whenever your "
    "next intake does.\"\n\n"
    "Then the two questions you actually came for:\n"
    "  1. \"If you did not know me, what would stop you saying yes?\"\n"
    "  2. \"Which slide would you forward to your partners, and which would you delete?\"\n\n"
    "Write the answers down the same day. Those two answers are worth more to you than the "
    "pilot itself."))
tf = tb(s, M, Inches(1.85), Inches(11), Inches(3.3))
para(tf, "THE ASK", 13, True, LILAC, 18, first=True)
para(tf, "One cohort. Four weeks. Free.", 42, True, WHITE, 10, line=1.06)
para(tf, "Nothing published without your approval.", 22, True, LILAC, 30, line=1.2)
para(tf, "And two questions I would like answered honestly:", 15, False, PALE, 10)
para(tf, "If you did not know me, what would stop you saying yes?", 17, True, WHITE, 5)
para(tf, "Which slide would you forward to your partners — and which would you delete?",
     17, True, WHITE, 0)
tf = tb(s, M, Inches(6.35), Inches(11.6), Inches(0.5))
para(tf, "Lomonec LLC  ·  contact@lomonec.com  ·  app.lomonec.com", 13, False, PALE, 0,
     first=True)

out = HERE / "Petrocertif-Pilot-Presentation.pptx"
prs.save(out)
print("%s  ·  %d slides  ·  %.0f KB" % (out.name, len(prs.slides.__iter__.__self__._sldIdLst),
                                        out.stat().st_size / 1024))
