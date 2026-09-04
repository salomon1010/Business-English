#!/usr/bin/env python3
"""Partner value deck — for the owners who were not in the first meeting.

A different argument from the pilot deck. That one asks for a cohort; this one
answers "what does this add to our academy?" for partners who have no reason to
care about the product tour. Business case, addressed to them: their offer,
their graduates, their differentiation, their expansion.

  python3 deck_assets.py && python3 build_value_deck.py
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
prs = new_deck()

CARD_L = RGBColor(0xF6, 0xF5, 0xFD)
CARD_D = RGBColor(0xEF, 0xED, 0xFB)
LINE_L = RGBColor(0xDD, 0xD9, 0xF5)
LINE_D = RGBColor(0xD6, 0xD0, 0xF4)
ROSE = RGBColor(0xFD, 0xEE, 0xEE)
ROSE_L = RGBColor(0xF2, 0xC9, 0xC9)
GOLD = RGBColor(0xFF, 0xF7, 0xE3)
GOLD_L = RGBColor(0xF0, 0xDF, 0xB4)


def bullets(s, x, y, w, rows, gap=Inches(1.12), h=Inches(0.96), fill=CARD_L,
            line=LINE_L, size=13.5):
    for lead, rest in rows:
        card(s, x, y, w, h, fill=fill, line=line)
        tf = tb(s, x + Inches(0.3), y + Inches(0.18), w - Inches(0.6), Inches(0.7))
        p = para(tf, "", size, False, BODY, 0, first=True, line=1.3)
        r = p.add_run(); r.text = lead
        r.font.name = "Arial"; r.font.size = Pt(size); r.font.bold = True
        r.font.color.rgb = INK
        if rest:
            r = p.add_run(); r.text = rest
            r.font.name = "Arial"; r.font.size = Pt(size); r.font.color.rgb = BODY
        y += gap
    return y


def three_up(s, items, y=Inches(2.62), h=Inches(3.3), fills=None):
    x = M
    for i, (eb, t_, d) in enumerate(items):
        fill, line = (fills[i] if fills else (CARD_L, LINE_L))
        card(s, x, y, Inches(3.72), h, fill=fill, line=line)
        tf = tb(s, x + Inches(0.3), y + Inches(0.26), Inches(3.1), Inches(0.3))
        para(tf, eb.upper(), 11.5, True, ACCENT, 0, first=True)
        tf = tb(s, x + Inches(0.3), y + Inches(0.64), Inches(3.1), Inches(0.8))
        para(tf, t_, 16, True, INK, 0, first=True, line=1.12)
        tf = tb(s, x + Inches(0.3), y + Inches(1.5), Inches(3.1), Inches(1.6))
        para(tf, d, 12.5, False, BODY, 0, first=True, line=1.32)
        x += Inches(3.94)


# ═══════════ 1 · title ═══════════
s = slide(prs, "deck-title.jpg", notes=(
    "This room is not the room you pitched. These partners were not at the first meeting, they "
    "have no reason to care about a product tour, and their question is simpler: what does this "
    "add to our academy?\n\n"
    "Open on that, not on yourself:\n\n"
    "\"I am not here to sell you software. I am here to show you what a communication layer "
    "adds to programmes you already run — and to ask for four weeks to prove it at no cost.\""))
tf = tb(s, M, Inches(2.5), Inches(10.6), Inches(2.6))
para(tf, "PARTNERSHIP VALUE", 13, True, LILAC, 20, first=True)
para(tf, "What this adds to\n%s" % PARTNER, 38, True, WHITE, 16, line=1.08)
para(tf, "A communication layer for programmes you already run",
     17, False, PALE, 0)

# ═══════════ 2 · what you already do well ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "Start with them, not with you. Say what they are good at, accurately, and mean it.\n\n"
    "\"You train people to read a P&ID, an isometric, a metal-structure drawing. Nine "
    "programmes, supervisory pathways, a Pearson VUE centre, a route to CMIT and CIOB. That is "
    "a serious technical offer and none of it needs fixing.\"\n\n"
    "You are establishing that you have done your homework and you are not about to tell them "
    "their business."))
eyebrow(s, "Where you already are")
heading(s, "You build technically competent people", size=32)
rule(s, Inches(2.12))
three_up(s, [
    ("The offer", "Nine specialised programmes",
     "Reading and interpretation of plans across piping, civil, electrical, instrumentation, "
     "renewables, metal structures and storage tanks."),
    ("The pathway", "Supervisory progression",
     "Storage tank, boiler and pressure vessel, industrial piping, welding production — the "
     "roles your graduates are actually aiming at."),
    ("The horizon", "International certification",
     "A Pearson VUE route toward CMIT, CCM and CIOB. Your learners are being prepared for a "
     "market beyond Cameroon."),
])
tf = tb(s, M, Inches(6.2), Inches(11.6), Inches(0.5))
para(tf, "None of that needs fixing. This is about the one step after it.",
     15, True, MUTED, 0, first=True)
footer(s)

# ═══════════ 3 · the step after ═══════════
s = slide(prs, "deck-dark-left.jpg", notes=(
    "Say it slowly. Then stop and let it sit.\n\n"
    "\"That market is English-speaking. Your graduate can read the drawing perfectly — and then "
    "has to brief a crew from it, tell a fabricator the fit-up is wrong, answer an inspector, "
    "and sit an interview. In English, out loud, under pressure.\"\n\n"
    "Then: \"Reading is taught. Saying it is not.\" Pause. If one of them nods, you have the "
    "room."))
tf = tb(s, M, Inches(2.05), Inches(10.4), Inches(3.75))
para(tf, "THE STEP AFTER", 13, True, LILAC, 22, first=True)
para(tf, "The market you prepare them for", 33, True, WHITE, 8, line=1.12)
para(tf, "runs in English, out loud.", 33, True, LILAC, 24, line=1.12)
para(tf, "A drawing read perfectly is worth nothing if the supervisor cannot brief the crew "
         "from it, answer the inspector, or get through the interview that puts them on the "
         "site in the first place.", 15, False, PALE, 0, line=1.4)
footer(s, dark=True)

# ═══════════ 4 · you already promise it ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "Their own words. Do not say it accusingly — whoever wrote it believed it, and they were "
    "right to.\n\n"
    "\"You already tell learners this. It is on the course page today. So the question is not "
    "whether English belongs in your offer — you decided that. The question is whether it is "
    "delivered and evidenced, or just promised.\"\n\n"
    "This is the slide that makes the rest of the meeting easy, because you are arguing from "
    "their decision, not yours."))
eyebrow(s, "You have already decided this matters")
heading(s, "It is on your course page today", size=32)
rule(s, Inches(2.12))
card(s, M, Inches(2.6), Inches(11.6), Inches(1.75), fill=CARD_D, line=LINE_D)
tf = tb(s, M + Inches(0.42), Inches(2.88), Inches(10.8), Inches(1.2))
para(tf, "“Enhance your professional English skills, with certification in written and spoken "
         "English and a shadowing approach via our LomoneC App — app.lomonec.com”",
     17, True, INK, 6, first=True, line=1.3)
para(tf, "— %s, published course offer" % PARTNER, 12, False, MUTED, 0)
tf = tb(s, M, Inches(4.7), Inches(11.6), Inches(1.6))
para(tf, "The decision is made. What is missing is delivery and proof.",
     19, True, INK, 8, first=True)
para(tf, "Today that line is a promise with nothing behind it. Four weeks from now it can be a "
         "number you are willing to publish.", 15, False, BODY, 0, line=1.35)
footer(s)

# ═══════════ 5 · the package ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "Do not walk through this item by item — they will read it. Name the shape of it:\n\n"
    "\"This is the whole package, and it is not a subscription to a vocabulary app. It is "
    "workplace conversation practice, an interview room, a report that names what was missing, "
    "and a record the learner can show an employer. Free for your learners during the pilot, "
    "and free for the academy permanently — there is no platform fee in this model.\"\n\n"
    "If someone asks the cost question here, take it: 'Nothing during the pilot. After it, "
    "whatever the pilot shows is fair — and you would help set that.'"))
eyebrow(s, "What is in the package")
heading(s, "Everything your learners would get", size=32)
rule(s, Inches(2.12))
left = [
    ("12 workplace conversations", " — with a five-person crew: HR, supervisor, coworker, "
     "safety officer, QA inspector"),
    ("12 interview coaches", " — one per part of the professional story, repeatable without limit"),
    ("A report on every answer", " — what was covered, what was missed, the better sentence"),
]
right = [
    ("A career centre", " — destination guidance, plus a CV and LinkedIn coach"),
    ("Evidence they can show", " — answers spoken, coverage, trade words actually used"),
    ("84 guided daily sessions", " — 25 minutes a day, in 15 languages, offline after first load"),
]
bullets(s, M, Inches(2.6), Inches(5.6), left)
bullets(s, M + Inches(6.0), Inches(2.6), Inches(5.6), right)
card(s, M, Inches(6.06), Inches(11.6), Inches(0.86), fill=GOLD, line=GOLD_L)
tf = tb(s, M + Inches(0.34), Inches(6.26), Inches(11.0), Inches(0.5))
para(tf, "No per-seat fee, no platform fee, no contract for the pilot. Your learners install it "
         "from a browser — there is nothing for your IT to deploy.",
     13.5, True, INK, 0, first=True, line=1.25)
footer(s)

# ═══════════ 6 · what it adds to the offer ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "This is the commercial slide and the one the partners actually came for. Slow down.\n\n"
    "\"Three things this adds that you cannot currently claim. Your offer gets a differentiator "
    "no competing academy in the region has. Your graduates get placeable in English-speaking "
    "markets, which is the outcome they are paying you for. And you get evidence — not "
    "attendance, evidence — that you can put in front of an employer or a funder.\"\n\n"
    "If they only remember one slide, this is it."))
eyebrow(s, "The commercial case")
heading(s, "Three things you cannot claim today", size=32)
rule(s, Inches(2.12))
three_up(s, [
    ("01  Your offer", "A differentiator, not a feature",
     "Every academy in the region teaches drawings. None of them can say their graduates "
     "rehearse the interview and the site conversation in English. That is a reason to choose "
     "you, and it is defensible."),
    ("02  Your graduates", "Placeable, not just qualified",
     "The certificate gets them shortlisted. The interview decides it. This is the only part of "
     "the journey nobody currently prepares them for."),
    ("03  Your evidence", "Outcomes you can publish",
     "A report on what the cohort actually did — spoken answers, coverage, improvement — that "
     "you can show employers, funders and the next intake."),
], fills=[(CARD_L, LINE_L), (CARD_D, LINE_D), (CARD_L, LINE_L)])
footer(s)

# ═══════════ 7 · where it fits ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "Be straight about the limit before anyone finds it. In a room of partners this earns more "
    "than a feature would.\n\n"
    "\"Three of your programmes are covered today. Six are not. I am not going to stand here and "
    "tell you otherwise.\"\n\n"
    "Then hand them the decision: \"The pilot decides which one is built next, and you choose "
    "it.\" A partner who picks the roadmap is a partner, not a customer."))
eyebrow(s, "Being straight about the limit")
heading(s, "Three of your programmes today", size=32)
rule(s, Inches(2.12))
hdr_y = Inches(2.6)
card(s, M, hdr_y, Inches(11.6), Inches(0.52), fill=INK, line=INK)
tf = tb(s, M + Inches(0.3), hdr_y + Inches(0.13), Inches(5.0), Inches(0.3))
para(tf, "COVERED NOW", 11, True, WHITE, 0, first=True)
tf = tb(s, M + Inches(5.4), hdr_y + Inches(0.13), Inches(6.0), Inches(0.3))
para(tf, "WHAT THE LEARNER REHEARSES", 11, True, WHITE, 0, first=True)
rows = [
    ("Plans in Boiler Making", "Briefing a crew from the drawing; clarifying with the fabricator"),
    ("Industrial Piping Supervisor", "Walking a contractor through an isometric"),
    ("Welding Production Supervision", "A weld-quality concern with a QA inspector; stop-work"),
]
y = hdr_y + Inches(0.52)
for i, (a_, b_) in enumerate(rows):
    card(s, M, y, Inches(11.6), Inches(0.72),
         fill=RGBColor(0xFF, 0xFF, 0xFF) if i % 2 == 0 else CARD_L,
         line=RGBColor(0xE4, 0xE1, 0xF6))
    tf = tb(s, M + Inches(0.3), y + Inches(0.2), Inches(5.0), Inches(0.4))
    para(tf, a_, 13.5, True, INK, 0, first=True, line=1.15)
    tf = tb(s, M + Inches(5.4), y + Inches(0.2), Inches(6.0), Inches(0.4))
    para(tf, b_, 13.5, False, BODY, 0, first=True, line=1.15)
    y += Inches(0.72)
card(s, M, y + Inches(0.36), Inches(11.6), Inches(1.15), fill=GOLD, line=GOLD_L)
tf = tb(s, M + Inches(0.34), y + Inches(0.56), Inches(11.0), Inches(0.85))
para(tf, "NOT BUILT YET", 11, True, RGBColor(0x8A, 0x63, 0x0B), 4, first=True)
para(tf, "Electrical, civil, instrumentation, renewable energy, metal structures, storage "
         "tanks. The pilot decides which is built next — and you choose it.",
     14, True, INK, 0, line=1.25)
footer(s)

# ═══════════ 8 · the risk slide ═══════════
s = slide(prs, "deck-dark.jpg", notes=(
    "Partners think about downside before upside. Get there before they do.\n\n"
    "\"Let me do the risk assessment for you. It costs nothing. It commits you to nothing. It "
    "touches none of your technical teaching or your certification. No learner data leaves the "
    "learner's phone. And either side can stop it on any day for any reason.\"\n\n"
    "Then be quiet for a beat. This slide is designed to end objections, not to start them."))
tf = tb(s, M, Inches(1.5), Inches(11), Inches(1.2))
para(tf, "THE DOWNSIDE, HONESTLY", 13, True, LILAC, 14, first=True)
para(tf, "What this costs you if it fails", 38, True, WHITE, 0, line=1.05)
items = [("$0", "money"), ("0", "IT work"), ("20 min", "of your time"), ("Any day", "you can stop")]
x = M
for big, lab in items:
    card(s, x, Inches(3.3), Inches(2.66), Inches(1.5),
         fill=RGBColor(0x3A, 0x2C, 0x78), line=RGBColor(0x6B, 0x59, 0xC4))
    tf = tb(s, x, Inches(3.52), Inches(2.66), Inches(0.7))
    para(tf, big, 30, True, LILAC, 2, first=True, align=PP_ALIGN.CENTER)
    tf = tb(s, x, Inches(4.24), Inches(2.66), Inches(0.35))
    para(tf, lab.upper(), 11.5, True, WHITE, 0, first=True, align=PP_ALIGN.CENTER)
    x += Inches(2.96)
tf = tb(s, M, Inches(5.25), Inches(11.6), Inches(1.2))
para(tf, "Your technical teaching, your assessments and your certification are untouched. "
         "Recordings never leave the learner's phone, and nothing is published without your "
         "written approval.", 16, False, PALE, 0, first=True, line=1.35)
footer(s, dark=True)

# ═══════════ 9 · what we ask ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "Read the left column slowly. It is short on purpose — that shortness is the offer.\n\n"
    "\"Four things from you, three of which take under an hour in total. Everything else is "
    "mine, including the measuring and every learner support question.\"\n\n"
    "Get a name for the instructor before you leave the room. A pilot with a named instructor "
    "happens; one without drifts."))
eyebrow(s, "The exchange")
heading(s, "What we ask, and what we bring", size=32)
rule(s, Inches(2.12))
cols = [
    ("WHAT WE ASK OF YOU", CARD_D, LINE_D, [
        ("One cohort", "20–30 learners from three programmes"),
        ("Twenty minutes", "one induction slot, once"),
        ("One instructor", "10 minutes in week 2 and week 4"),
        ("Permission", "to write the result up jointly")]),
    ("WHAT WE BRING", CARD_L, LINE_L, [
        ("Full access", "every learner, free, pilot plus 30 days"),
        ("Onboarding", "guide in French and English, we run the induction"),
        ("All support", "learner questions come to us, never to your staff"),
        ("The report", "yours to show, with the data behind it")]),
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

# ═══════════ 10 · after the pilot ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "Partners want to know where this goes, not just what it is. Be clear that nothing here is "
    "decided today.\n\n"
    "\"If the pilot works, there are four ways this can grow, and you would pick. If it does "
    "not work, we both learned something for the price of four weeks and no money.\"\n\n"
    "Do not price anything in this room. If pushed: 'I would rather set that from what the "
    "pilot shows than guess in front of you — and I would want your view on what is fair.'"))
eyebrow(s, "If it works")
heading(s, "Four ways this can grow — you choose", size=32)
rule(s, Inches(2.12))
opts = [
    ("Student access", "Individual learner licences attached to your technical programmes, "
     "priced so they sit inside an existing course fee."),
    ("Cohort licensing", "Access for a class, an intake or a centre, with the cohort reporting "
     "you would have seen in the pilot."),
    ("Bundled programmes", "BE Mastery included as the communication layer of a named "
     "Petrocertif course — part of what the learner buys from you."),
    ("Custom pathways", "A discipline built to your curriculum: your scenarios, your "
     "terminology, your assessment language."),
]
x, y = M, Inches(2.62)
for i, (t_, d) in enumerate(opts):
    card(s, x, y, Inches(5.6), Inches(1.72))
    tf = tb(s, x + Inches(0.32), y + Inches(0.26), Inches(5.0), Inches(1.2))
    para(tf, t_, 16, True, INK, 5, first=True, line=1.1)
    para(tf, d, 12.5, False, BODY, 0, line=1.32)
    if i % 2 == 0:
        x += Inches(6.0)
    else:
        x = M; y += Inches(1.86)
tf = tb(s, M, Inches(6.5), Inches(11.6), Inches(0.5))
para(tf, "None of this is decided today. The pilot is free either way.",
     14, True, MUTED, 0, first=True)
footer(s)

# ═══════════ 11 · what it is not ═══════════
s = slide(prs, "deck-light.jpg", notes=(
    "Never let a partner discover this on their own. Saying it yourself is the difference "
    "between a partner and a vendor.\n\n"
    "\"Three things this is not, and I would rather you heard them from me. It is not a trade "
    "qualification. It is not a recognised English proficiency certificate — the certificate is "
    "for completing the app's own programme, and written English is not assessed at all. And it "
    "replaces nothing you teach.\"\n\n"
    "Then raise the course-page wording. Frame it as protecting them: if a learner enrols "
    "expecting a written-English certificate, the complaint arrives at Petrocertif, not at you. "
    "A suggested replacement sentence is in the proposal."))
eyebrow(s, "Scope and integrity", colour=RGBColor(0xA3, 0x2B, 0x2B))
heading(s, "What this is not", size=32)
rule(s, Inches(2.12), colour=RGBColor(0xA3, 0x2B, 0x2B))
nots = [
    ("Not a trade qualification",
     "It does not certify that anyone can weld. AWS, ASME, IIW and your own assessments are "
     "untouched by it."),
    ("Not an English proficiency certificate",
     "The certificate is for completing the app's own 84-session programme. It is not IELTS, "
     "not a CEFR level, and written English is not assessed at all."),
    ("Not a replacement for your teaching",
     "One layer on top of your programme: professional English, workplace communication "
     "practice, and evidence of both."),
]
y = Inches(2.6)
for t_, d in nots:
    card(s, M, y, Inches(11.6), Inches(1.18), fill=ROSE, line=ROSE_L)
    tf = tb(s, M + Inches(0.34), y + Inches(0.22), Inches(11.0), Inches(0.85))
    para(tf, t_, 15, True, INK, 3, first=True, line=1.1)
    para(tf, d, 12.5, False, BODY, 0, line=1.28)
    y += Inches(1.32)
tf = tb(s, M, Inches(6.5), Inches(11.6), Inches(0.5))
para(tf, "Your course page currently promises certification in written and spoken English. "
         "Worth correcting before a cohort starts — a suggested sentence is in the proposal.",
     12.5, True, MUTED, 0, first=True)
footer(s)

# ═══════════ 12 · the decision ═══════════
s = slide(prs, "deck-dark.jpg", notes=(
    "One decision, stated plainly, then silence. Do not fill it.\n\n"
    "\"The only decision today is whether one cohort tries this for four weeks. Not a contract, "
    "not a price, not a commitment to anything after it.\"\n\n"
    "If you get a yes, ask for the week-0 date and the instructor's name before you leave the "
    "room. If you get a no, ask the one question worth more than the pilot: \"What would have "
    "had to be true for this to be a yes?\""))
tf = tb(s, M, Inches(1.9), Inches(11), Inches(3.3))
para(tf, "THE DECISION", 13, True, LILAC, 18, first=True)
para(tf, "One cohort. Four weeks. Free.", 40, True, WHITE, 10, line=1.06)
para(tf, "Not a contract. Not a price. Not a commitment to anything after it.",
     20, True, LILAC, 28, line=1.2)
para(tf, "If yes — we need a start date and one instructor's name.", 17, True, WHITE, 6)
para(tf, "If no — I would like to know what would have had to be true.",
     17, False, PALE, 0)
tf = tb(s, M, Inches(6.3), Inches(11.6), Inches(0.5))
para(tf, "Lomonec LLC  ·  contact@lomonec.com  ·  app.lomonec.com", 13, False, PALE, 0,
     first=True)

out = HERE / "Petrocertif-Partner-Value-Presentation.pptx"
prs.save(out)
print("%s  ·  %d slides  ·  %.0f KB" % (out.name, len(prs.slides._sldIdLst),
                                        out.stat().st_size / 1024))
