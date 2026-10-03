# Welding — AI and account behaviour, as it stands

**Date:** 1 October 2026 · **Branch:** `feature/product-boundary-implementation`
**Status: AUDIT ONLY — NO WELDING UI OR BEHAVIOUR WAS CHANGED IN THIS TASK**
(one honest-error consequence excepted and declared in §4.)

J3 asked whether Welding should eventually get the F7 pre-activity account
notice. This is what Welding does today, so that decision can be made on
evidence rather than on assumption.

## 1. The requirement is identical on both tracks

`be-polish` has **no track term anywhere**. With `PREMIUM_ENFORCED = "1"`,
`premiumGate`'s `cap === null` branch demands a verified account on every
route, free ones included; `entGated()` carries no track term either (owner,
30 September 2026: one subscription covers both programmes). So a signed-out
Welding learner is refused exactly as a signed-out General English learner is.

Measured on the live staging Workers, 1 October 2026, with no token:

| Call | Result |
|---|---|
| `audio/webm` (a workshop or interview turn) | `401 auth_required` |
| `chat` purpose `practice` | `401 auth_required` |

## 2. What Welding shows today

| Surface | Signed out, enforcement on | Honest? |
|---|---|---|
| Interview / workshop spoken turn | the turn reports the reason through `fbTxWhy()` → `fbTxWhyText()` (`account`), not `SIM_NOTHING_HEARD` | **Yes**, since the 1 Oct shakeout fix |
| Welding Shadow lines, recording | the recording is kept and the day counts; the grade is absent with the reason named | **Yes** |
| Shadow translation / IPA | `svShTrFetch` throws `"acct"` before the request and the card says so | **Yes** |
| Executive Polish | the refusal is reported, not swallowed | **Yes** |
| **A pre-activity notice** | **none** — `aiAcctNeeded()` carries `&& isGeneralEnglish()` | n/a — this is the gap |
| Practice Partner | not reachable at all (`rPartner` → `!isGeneralEnglish()` → empty + back to Practice), and `be-partner`'s `TRACKS = new Set(["general-english"])` refuses the track `403` server-side | **Yes**, by design |

So Welding is **honest but late**, which is precisely the state General English
was in before F7: the learner starts, speaks, and is then told they need an
account.

## 3. Should Welding get its own notice?

**Recommendation: yes, and it is one term.** Delete `&& isGeneralEnglish()`
from `aiAcctNeeded()` (index.html) and the five existing call sites light up on
both tracks. Nothing else is needed, because every insertion point except the
role-play intro is a shared screen.

The arguments for doing it:

- The requirement is real on Welding, so withholding the notice withholds a
  true statement, not a General English feature.
- Welding's flagship loop is the spoken interview and the workshop. It is the
  track where a late refusal costs the most.
- The audience is francophone-majority and the Welding voice surface is still
  hard-coded English (C1 in `SHAKEOUT_2026-10-01.md`), so a Welding learner
  already has less to go on.

The argument for waiting, which is why it was not done here: the approved brief
for F7 said General English only, and a notice is visible product copy. It is
the owner's call, not a defect, and the cost of reversing it is one term.

**What would NOT be acceptable** is extending the notice by copying it into
Welding-specific screens — that would create a second implementation of the
same statement. One helper, one term.

## 4. The one Welding-visible change in this task, declared

J1 made `ytai` — AI transcription of a video the learner pasted — require a
verified account in every configuration, because it is the one free route that
spends real money per call. **That requirement is track-blind**, because
`be-polish` has no reliable track signal on this route and cost control must not
depend on one.

The client guard `ytaiNoAccount()` therefore carries **no** `isGeneralEnglish()`
term, and the Welding studio does accept pasted videos. The consequence on
Welding is exactly one changed message: a signed-out learner who pastes a video
now reads *"Sign in to transcribe this video … the video itself is fine"*
instead of *"No transcript for this video"*.

That is a lie becoming true, not a feature moving. Scoping the guard to General
English would have meant knowingly shipping the false message to Welding, which
is the defect class this whole workstream exists to remove. It is recorded here
rather than buried; reverting it is one term, and the result would be the lie.

Nothing else about Welding changed: no UI, no curriculum, no simulations, no
interview, no Practice Partner exposure, no track authorisation.
