# BE Mastery — specification

The official specification. Read in this order; where two documents conflict,
the one higher in this list wins.

| # | Document | Answers |
|---|---|---|
| 1 | [PRODUCT_VISION.md](PRODUCT_VISION.md) | What this product is, what it refuses to be, and the tie-breaker when two designs are equally good |
| 2 | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Tokens, colour meanings, type, spacing, motion, voice, the i18n contract |
| 3 | [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) | What already exists — reuse before adding |
| 4 | [INTERACTION_SPECIFICATION.md](INTERACTION_SPECIFICATION.md) | How things must behave: keyboard, screen readers, contrast, states, verification, definition of done |
| 5 | [RETENTION_STRATEGY.md](RETENTION_STRATEGY.md) | Why a user comes back tomorrow, and what we refuse to do to make them |
| 6 | [UX_AUDIT.md](UX_AUDIT.md) | Measured findings per screen, and the cross-screen defect list |
| 7 | [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Screen order, status, ship discipline |

`../CLAUDE.md` remains the engineering guide — architecture, secrets, deploy
mechanics, feature history. These documents govern design and product; it
governs the code.

## Rules

- **Never silently diverge.** If implementation reveals a better solution:
  explain why → update the document → then implement.
- **Nothing here is estimated.** Every number was measured, every component
  claim was grepped. If something is aspirational it is marked *(target)*; if
  it is broken it is marked *(defect)* or *(known gap)*.
- **One screen at a time**, and never start the next without approval.

Authored 2026-08-02, alongside the Dashboard pass (`9450bed`).
