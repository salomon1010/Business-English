# Partnership proposal — BE Mastery × Industrial Training Partner

Two documents, one design system.

| File | Audience |
|---|---|
| `BE-Mastery-Industrial-Training-Partnership-Proposal.docx` | **Send this.** The pitch. |
| `BE-Mastery-Petrocertif-Academy-Pilot-Proposal.docx` | **Send this** to Petrocertif / JFN Academy. The adapted, named version. |
| `BE-Mastery-Partnership-Target-List-INTERNAL.docx` | **Never send this.** Who to approach, in what order, and why. |
| `Petrocertif-Pilot-Presentation.pptx` | **Present to the sponsor.** 18 slides — the pilot proposal, with the product shown on screen. |
| `Petrocertif-Partner-Value-Presentation.pptx` | **Present to the other partners.** 12 slides — the business case, no product tour. |
| `BE-Mastery-Pilot-Playbook.docx` | **Send on yes.** How the four weeks run: roles, schedule, tools, forms. |
| `BE-Mastery-Learner-Guide-EN-FR.docx` | **Send to learners** in week 0. Bilingual, two pages. |
| `petrocertif-first-approach.md` | **Never send this.** The message to write, the questions to ask, the wording problem to raise. |
| `presentation-brief.md` | **Never send this.** Rehearsal notes, objections, what to send when. |

Keeping them apart is the point: the target list carries the prioritisation, the
two segments deliberately left unnamed, and the caution about not citing a
reference you have not cleared. None of that should reach a prospect.

Reproduces from a clean checkout:

    python3 build_assets.py      # wordmark + mastheads + closing bands -> assets/
    python3 build_proposal.py    # -> ...Partnership-Proposal.docx
    python3 build_targets.py     # -> ...Target-List-INTERNAL.docx
    python3 build_jfn.py         # -> ...Petrocertif-Academy-Pilot-Proposal.docx
    python3 build_playbook.py    # -> BE-Mastery-Pilot-Playbook.docx
    python3 build_learner_guide.py   # -> BE-Mastery-Learner-Guide-EN-FR.docx
    python3 deck_assets.py
    python3 build_deck.py        # -> Petrocertif-Pilot-Presentation.pptx
    python3 build_value_deck.py  # -> Petrocertif-Partner-Value-Presentation.pptx
    python3 check_deck.py  [deck.pptx]   # box fit, collisions, speaker notes
    python3 render_deck.py [deck.pptx]   # slide PNGs + contact sheet

`deckkit.py` holds the shared slide kit; branding is baked into the background
images by `deck_assets.py`, so it cannot be dragged off or lost when a slide is
duplicated.
    python3 check_fit.py [file]  # per-page fill, so nothing silently overflows

`docxkit.py` holds the shared layout kit — palette, ruled section headings,
lavender cards, gutter arithmetic — so the two documents cannot drift apart.

**Design** follows the Lomonec offer sheet: indigo masthead, letterspaced
eyebrows over ruled section headings, lavender cards, a dark closing band.

**Branding.** The Lomonec wordmark is rebuilt in `build_assets.py` rather than
committed as a binary — proportions taken from the supplied artwork (the rule
above the L spans ~24% of the wordmark; "EC" is the accent half). The BE Mastery
tile is lifted out of `icon-512.png`, which bakes in a dark plate that would
otherwise read as a black box on the band.

**Editable on purpose.** Only the two bands are images. Every heading, table and
card is real Word text, so the partner name, the cohort size and the pilot
length can be changed without a designer.

## Gotchas found the hard way

- `w:tblPr` and `w:tcPr` children must be in schema order or a reader may drop
  them; `normalise()` sorts both before saving.
- Table widths are set in **percent**. Fixed layout plus dxa widths is the
  textbook answer, but a reader that autofits anyway still shrink-wraps a table
  with short cells — which is what collapsed the welder-pathway table.
- Column widths must be set on `table.columns` (`w:tblGrid`), not only on cells.

## Two decks, two rooms

The pilot deck argues *to the sponsor* and shows the product on screen — he has
to believe the thing works. The value deck argues *to the other partners*, who
were not at that meeting and have no reason to care about a product tour: what
it adds to the offer, to graduates, to placement, and what it costs if it fails
(nothing). Same design system, different argument.

## Foundations changed the pilot (September 2026)

The first francophone learners said the app opened above their level. The app
now has a one-minute placement check and a fifteen-day Foundations stage on both
tracks — glossed in all fifteen app languages, French for this cohort — and
every document here was revised to match: the pilot runs as two
stages, the baseline is three Foundations sentences recorded on day one (which
an A1 learner can actually do), and "progress through Foundations" is the
eighth measure. The pilot question changed too — it now asks whether learners
starting where they really are reach their first workplace conversation in four
weeks.

## Sequencing — this matters more than the documents

Proposal at the meeting. Playbook only once they say yes; sent earlier it turns
a free four-week trial into an implementation project. Learner guide in week 0,
with the induction invite.

## Verification

No LibreOffice or pandoc here, and Word's AppleScript dictionary does not load
on this machine, so the .docx could not be rendered by Word itself. What was
checked: QuickLook renders page 1 faithfully (see `assets/preview-page1.png`),
the file reads back cleanly through python-docx, and `check_fit.py` measures
every page against the 28.6 cm column.

To produce the PDF: open in Word and File → Save As → PDF.

The deck has no renderer here either — PowerPoint's AppleScript reports a
successful export and writes no files, and `qlmanage` hangs on .pptx. So
`check_deck.py` measures every text box against its frame and flags collisions,
and `render_deck.py` draws the saved presentation with Pillow to
`assets/deck-preview/`. That preview is read from the file, not from intent,
which is how the footer collision on slide 13 was found — the box-fit check
could not see it.

## The Petrocertif version

Adapted, not re-templated. Their published course offer already names the app
("…via our LomoneC App: app.lomonec.com"), so the argument is that the promise
exists and this makes it real — not "please try my product". Written to be
forwarded: the champion is one partner among several.

Scoped to boilermaking, industrial piping and welding production supervision,
because those are the three trades BE Mastery actually carries. The other six
disciplines in their catalogue are named as the expansion the pilot chooses,
not as things that exist.

Section 06 states in writing that the certificate is a completion certificate,
not a proficiency qualification, and that written English is not assessed —
their course page currently promises "certification in written and spoken
English", which the product does not do.

## Facts in the target list

Every organisation, email and phone number was taken from that organisation's own
published pages in September 2026 — none is inferred, and none was recalled from
memory. Two segments are named only as categories (overseas recruitment agencies,
large EPC contractors) because the specific operators could not be vouched for.
The note about IRCC OSLT funding ending is flagged **unverified** in the document
itself; one college page 404'd and another blocked automated access.

## Facts in the proposal

Verified against the app source, not asserted: 12 workplace scenarios, a
five-person cast, 12 interview coaches, 15 language files, offline after first
load. No learner numbers or outcome claims are stated anywhere — there is no
pilot data yet.
