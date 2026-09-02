# Partnership proposal — BE Mastery × Industrial Training Partner

Two documents, one design system.

| File | Audience |
|---|---|
| `BE-Mastery-Industrial-Training-Partnership-Proposal.docx` | **Send this.** The pitch. |
| `BE-Mastery-Partnership-Target-List-INTERNAL.docx` | **Never send this.** Who to approach, in what order, and why. |

Keeping them apart is the point: the target list carries the prioritisation, the
two segments deliberately left unnamed, and the caution about not citing a
reference you have not cleared. None of that should reach a prospect.

Reproduces from a clean checkout:

    python3 build_assets.py      # wordmark + mastheads + closing bands -> assets/
    python3 build_proposal.py    # -> ...Partnership-Proposal.docx
    python3 build_targets.py     # -> ...Target-List-INTERNAL.docx
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

## Verification

No LibreOffice or pandoc here, and Word's AppleScript dictionary does not load
on this machine, so the .docx could not be rendered by Word itself. What was
checked: QuickLook renders page 1 faithfully (see `assets/preview-page1.png`),
the file reads back cleanly through python-docx, and `check_fit.py` measures
every page against the 28.6 cm column.

To produce the PDF: open in Word and File → Save As → PDF.

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
