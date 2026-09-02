#!/usr/bin/env python3
"""Partnership target list & outreach plan — INTERNAL (.docx).

Companion to the partnership proposal, same visual language, but this one never
goes to a partner: it carries the prioritisation, the reasons, and the two
segments deliberately left unnamed.

Every organisation, email and phone number here was taken from that
organisation's own published pages in September 2026 — none is inferred. The
OSLT funding note is flagged unverified on purpose.
"""
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.shared import Cm, Pt, RGBColor

from docxkit import (A, ACCENT, BODY, CARD, CARD2, CONTENT_W, DARK, GAP, GOLD,
                     HERE, INK, LILAC, MINT, MUTED, ROSE, WHITE, bleed_image,
                     bullet, callout, card, card_grid, cell_border,
                     cell_margins, grid, gutter, new_document, normalise,
                     section_head, shade, spacing, txt)

def pagebreak(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    gutter(doc, 10)


AMBER_INK = RGBColor(0x8A, 0x63, 0x0B)
ROSE_INK = RGBColor(0xA3, 0x2B, 0x2B)
GREEN_INK = RGBColor(0x1D, 0x6B, 0x46)

doc = new_document()
bleed_image(doc, A / "header-targets.jpg")

callout(doc, ROSE, "F2C9C9", "Internal — not for circulation", ROSE_INK,
        [("This is the working list, not the pitch. ", True),
         ("It contains the order of attack and the reasons behind it. The document to "
          "send a partner is the partnership proposal; send that one.", False)])
gutter(doc, 8)

section_head(doc, "01", "How this list is ordered")
txt(doc, "Speed to a signed pilot comes from three things: the organisation’s stated mission "
         "already depends on English, there is one decision-maker rather than a procurement "
         "process, and you can name a peer they respect. That points away from large employers "
         "and government ministries, and toward welding certification bodies and "
         "newcomer-bridging charities.", size=10, after=7, line=1.4)
callout(doc, MINT, "BFE0CE", "The framing that makes this easy", GREEN_INK,
        [("There are no pilot results yet, so nothing here is a product sale. ", True),
         ("Every approach offers a free, four-week, measured cohort. That is a far easier yes, "
          "and it is the thing that produces Case Study #1.", False)])
gutter(doc, 8)

section_head(doc, "02", "Tier A · Africa — weeks, not months")
txt(doc, "These are IIW and AWS certification bodies. Their purpose is certifying welders to "
         "international standards for international work, so their graduates meet the English "
         "wall the moment they apply abroad. They already know it.",
    size=10, after=8, line=1.38)

tierA = [
    ("The Welding Federation Africa (WeldFA)",
     "Highest leverage on this page. A continental umbrella of 14 national welding societies — "
     "Nigeria, Egypt, South Africa, Ethiopia, Uganda, Namibia, Morocco, Libya, Cameroon, Kenya, "
     "Ghana, Senegal, Tunisia. One conversation can introduce a dozen national bodies.",
     "info@weldfa.org  ·  +27 79 714 9277  ·  weldfa.org/contacts-weldfa/\n"
     "SAIW, 52 Western Boulevard, City West, Johannesburg 2092"),
    ("Cameroon Welding Association (CamWeldAs)",
     "Home ground and the fastest possible yes. IIW-accredited since 2012, running IIW "
     "International Welder through Welding Engineer diplomas. You can meet them in person, "
     "which is worth more than ten emails.",
     "training@cmrweldas.com  ·  cmrweldas.com/contact/  ·  Douala and Yaoundé"),
    ("Nigerian Institute of Welding (NIW-ANB)",
     "IIW Authorized National Body, accredited 2012, issues International Welder diplomas. "
     "Largest anglophone industrial market in West Africa, and it publishes a named contact — "
     "rare, and it means less bouncing between inboxes.",
     "Ayorinde A. Adeniyi  ·  management@niganb.com  ·  +234 803 223 1653  ·  Benin City"),
    ("East African Institute of Welding (Kenya)",
     "The bridge organisation. Trains to IIW standards and is accredited by the Canadian Welding "
     "Bureau as well as Kenya’s TVETA. If the pilot works here, the same story sells in Canada — "
     "and they can make that introduction.",
     "welding-institute.com"),
    ("Design and Technology Institute, Accra",
     "Commissioned Africa’s first AWS-certified welder training and testing centre — 40 booths, "
     "digital simulators, metallurgical lab — explicitly to place Ghanaian welders globally. "
     "Founder-led, so one decision-maker.",
     "dtiafrica.com  ·  founder Constance Elizabeth Swaniker  ·  Accra"),
]
for i, (name, why, contact) in enumerate(tierA):
    t = grid(doc, 1, 1, [CONTENT_W])
    c = t.cell(0, 0)
    shade(c, CARD2 if i else CARD); cell_margins(c, 120, 160, 120, 160)
    cell_border(c, "D6D0F4" if i == 0 else "DDD9F5")
    p = c.paragraphs[0]; p.text = ""
    r = p.add_run("A%d   " % (i + 1))
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(9); r.font.color.rgb = ACCENT
    r = p.add_run(name)
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(10.5); r.font.color.rgb = INK
    p.paragraph_format.space_after = Pt(3); p.paragraph_format.line_spacing = 1.15
    p2 = c.add_paragraph()
    r = p2.add_run(why)
    r.font.name = "Arial"; r.font.size = Pt(9); r.font.color.rgb = BODY
    p2.paragraph_format.space_before = Pt(0); p2.paragraph_format.space_after = Pt(4)
    p2.paragraph_format.line_spacing = 1.34
    p3 = c.add_paragraph()
    r = p3.add_run(contact)
    r.font.name = "Arial"; r.font.size = Pt(8.5); r.font.bold = True
    r.font.color.rgb = RGBColor(0x3B, 0x2A, 0x9E)
    p3.paragraph_format.space_before = Pt(0); p3.paragraph_format.space_after = Pt(0)
    p3.paragraph_format.line_spacing = 1.3
    gutter(doc, 5)
    if i == 1:
        pagebreak(doc)

txt(doc, "Africa first is not only convenience: the users are already francophone African, the "
         "app already runs in French, and the welding track already exists. Nothing new has to "
         "be built to serve these five.", size=9, colour=MUTED, before=2, after=0, line=1.4)

section_head(doc, "03", "Tier B · Canada — one to three months")
txt(doc, "Slower, but the mandate fit is sharper and there is a specific opening.",
    size=10, after=8, line=1.4)

t = grid(doc, 1, 1, [CONTENT_W])
c = t.cell(0, 0)
shade(c, CARD); cell_margins(c, 130, 160, 130, 160); cell_border(c, "D6D0F4")
p = c.paragraphs[0]; p.text = ""
r = p.add_run("B1   Skills for Change / WeldUp — Toronto")
r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(10.5); r.font.color.rgb = INK
p.paragraph_format.space_after = Pt(3)
p2 = c.add_paragraph()
for text, bold in [
    ("The single best-argued pitch anywhere on this list. WeldUp is a bridging programme for "
     "internationally trained welders, run with the CWB Group and funded by Ontario’s Ministry "
     "of Labour, Immigration, Training and Skills Development. It requires ", False),
    ("Canadian Language Benchmark 6 or higher to enrol.", True),
    ("  That gate is the pitch: every internationally trained welder turned away at CLB 5 is "
     "someone BE Mastery is built for. You are not competing — you are their on-ramp, and "
     "retention support for the ones who scrape in. Ask for one sentence in the rejection "
     "email.", False)]:
    r = p2.add_run(text)
    r.font.name = "Arial"; r.font.size = Pt(9); r.font.bold = bold
    r.font.color.rgb = INK if bold else BODY
p2.paragraph_format.space_before = Pt(0); p2.paragraph_format.space_after = Pt(4)
p2.paragraph_format.line_spacing = 1.34
p3 = c.add_paragraph()
r = p3.add_run("+1 416 658 3101  ·  1655 Dupont St, Toronto, Ontario M6P 3S9  ·  "
               "skillsforchange.org/weldup/")
r.font.name = "Arial"; r.font.size = Pt(8.5); r.font.bold = True
r.font.color.rgb = RGBColor(0x3B, 0x2A, 0x9E)
p3.paragraph_format.space_before = Pt(0); p3.paragraph_format.space_after = Pt(0)
gutter(doc, 6)

t, at = card_grid(doc, 1, 2)
card(at(0, 0), CARD2, "B2  CWB Group",
     "Runs the Milton training site behind WeldUp and accredits the East African Institute in "
     "Kenya. Use that accreditation link as a warm introduction from Africa into Canada — in "
     "that direction.")
card(at(0, 1), CARD2, "B3  Ontario OSLT colleges",
     "George Brown, Conestoga, Centennial, Niagara, Georgian and Fanshawe run free "
     "IRCC-funded Occupation-Specific Language Training, including Construction Skilled Trades "
     "streams. This is your product, delivered by people.")
gutter(doc, 6)

callout(doc, GOLD, "F0DFB4", "Verify before building a pitch on this", AMBER_INK,
        [("Search results indicate IRCC funding for OSLT delivery ends around September 2026. "
          "I could not confirm it — one college page returned 404 and another blocked "
          "automated access. ", False),
         ("If it is true, six colleges are about to lose funded occupational language training "
          "and would need a cheap replacement: a strong and time-limited hook. Phone one "
          "college and ask before you lead with it.", True)])
pagebreak(doc)

section_head(doc, "04", "Tier C · United States — three to six months, grant-bound")
txt(doc, "The model here is VESL / I-BEST: vocational English fused with trade training. It "
         "already exists, so BE Mastery is an enhancement rather than a new idea. These move on "
         "grant cycles and will want evidence you do not yet have — approach them after Tier A "
         "produces numbers.", size=10, after=8, line=1.38)
usa = [
    ("Grand Rapids Community College",
     "Runs a One Workforce welding programme specifically for English language learners, with "
     "the Hispanic Center of West Michigan. The closest US match to what you built."),
    ("LaGuardia CC — Center for Immigrant Education and Training",
     "National leader in the I-BEST model: integrated ESOL plus an occupational certificate, in "
     "one course."),
    ("Mt. Hood Community College, Oregon",
     "Integrated language-and-workforce courses, welding among them."),
    ("Upwardly Global",
     "18,000+ immigrant professionals supported, 150+ employer partners, and a curriculum "
     "already covering professional communication and interview preparation. Embeds its "
     "resources inside IRC local offices, so one yes propagates."),
]
t, at = card_grid(doc, 2, 2)
for i, (n, w) in enumerate(usa):
    card(at(i // 2, i % 2), CARD2, n, w)

gutter(doc, 8)
section_head(doc, "05", "Two segments deliberately left unnamed")
t, at = card_grid(doc, 1, 2)
card(at(0, 0), ROSE, "Overseas recruitment agencies",
     "On paper the sharpest pain — their placements fail on interviews, not welds. But searches "
     "returned mostly SEO-driven operators that cannot be vouched for, and parts of that "
     "industry exploit migrant workers. Reach them through WeldFA members’ own referrals, where "
     "someone credible is staking their name.", border="F2C9C9")
card(at(0, 1), ROSE, "Large EPC contractors and TVET ministries",
     "Real budgets, wrong timing. Procurement, security review and data-protection assessment "
     "will consume the months that should go into getting a first cohort measured.",
     border="F2C9C9")
pagebreak(doc)

section_head(doc, "06", "How to make the approach")
steps = [
    ("Send five sentences, not the proposal in the body.",
     "Who you are; that BE Mastery is the professional-English layer for technical training; "
     "that you are running a free four-week pilot with 20–30 learners; the one question the "
     "pilot answers; a request for 20 minutes. Attach the proposal as PDF."),
    ("Change four things per recipient — nothing else.",
     "“Industrial Training Partner” becomes their name throughout; the International Welder "
     "pathway table becomes their flagship programme; the cohort size fits one of their classes. "
     "The document was built to be edited for exactly this."),
    ("Lead with their gate, not your features.",
     "Skills for Change: CLB 6. CamWeldAs: IIW graduates failing overseas interviews. DTI: "
     "AWS-certified and globally placeable — in English. Section 03’s pilot question does the "
     "closing; the feature cards are there to be scanned, not read."),
    ("Ask for the smallest possible yes.",
     "One cohort, four weeks, free, you supply the measurement. No licence discussion until "
     "Case Study #1 exists."),
]
for i, (a, b) in enumerate(steps, start=1):
    t = grid(doc, 1, 1, [CONTENT_W])
    c = t.cell(0, 0)
    shade(c, CARD2); cell_margins(c, 110, 160, 110, 160); cell_border(c)
    p = c.paragraphs[0]; p.text = ""
    r = p.add_run("STEP %d   " % i)
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(7.5); r.font.color.rgb = ACCENT
    spacing(r, 26)
    r = p.add_run(a)
    r.font.name = "Arial"; r.font.bold = True; r.font.size = Pt(10); r.font.color.rgb = INK
    p.paragraph_format.space_after = Pt(3); p.paragraph_format.line_spacing = 1.18
    p2 = c.add_paragraph()
    r = p2.add_run(b)
    r.font.name = "Arial"; r.font.size = Pt(9); r.font.color.rgb = BODY
    p2.paragraph_format.space_before = Pt(0); p2.paragraph_format.space_after = Pt(0)
    p2.paragraph_format.line_spacing = 1.34
    gutter(doc, 5)

callout(doc, ROSE, "F2C9C9", "Two cautions", ROSE_INK,
        [("Do not cite JFN / Petrocertif as a reference until you have their written permission "
          "and actual numbers — a named reference that evaporates costs you the second meeting. "
          "And keep the scope paragraph in Section 06 of the proposal exactly as written: "
          "certification bodies read it first, and it is the sentence that makes you a partner "
          "rather than a threat.", False)])
gutter(doc, 8)

txt(doc, "Sources — every organisation, email and phone number above was taken from that "
         "organisation’s own published pages in September 2026: weldfa.org · cmrweldas.com · "
         "niganb.com · welding-institute.com · dtiafrica.com · skillsforchange.org/weldup · "
         "georgebrown.ca · grcc.edu · laguardia.edu · upwardlyglobal.org",
    size=8, colour=MUTED, after=10, line=1.45)
bleed_image(doc, A / "footer-internal.jpg")

normalise(doc)
cp = doc.core_properties
cp.title = "Partnership target list & outreach plan — INTERNAL"
cp.subject = "Where to take the BE Mastery partnership proposal first"
cp.author = "Lomonec LLC"
cp.company = "Lomonec LLC"
cp.category = "Internal working document"

out = HERE / "BE-Mastery-Partnership-Target-List-INTERNAL.docx"
doc.save(out)
print("%s  (%.0f KB)" % (out.name, out.stat().st_size / 1024))
