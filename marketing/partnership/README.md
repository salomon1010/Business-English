# Partnership proposal — BE Mastery × Industrial Training Partner

Reproduces from a clean checkout:

    python3 build_assets.py      # wordmark + masthead/closing bands -> assets/
    python3 build_proposal.py    # -> BE-Mastery-Industrial-Training-Partnership-Proposal.docx
    python3 check_fit.py         # per-page fill, so nothing silently overflows

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

## Facts in the document

Verified against the app source, not asserted: 12 workplace scenarios, a
five-person cast, 12 interview coaches, 15 language files, offline after first
load. No learner numbers or outcome claims are stated anywhere — there is no
pilot data yet.
