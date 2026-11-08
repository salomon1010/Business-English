# Weeks 2–12: what the guided lesson already supports (audit, 8 Nov 2026)

Read-only. `tests/weeks-audit.mjs` builds every day's plan and renders every step of its recipe, with the network blocked, against a served copy of `index.html` in which `DLP_WEEKS` is lifted to 12. **The repository still says `DLP_WEEKS = 1`.** Nothing here approves or enables anything.

```
node tests/weeks-audit.mjs http://127.0.0.1:<port>      # a server that serves index.html with `const DLP_WEEKS=1;` replaced by 12
```

## What works

- **84 of 84 days** build, validate, validate against the curriculum and render every step of their recipe: no page error, empty screen, raw translation key or `undefined`. Same for a learner with a profile and one with none.
- The engine is genuinely week-agnostic: a recipe is chosen from the day's own words (`DailyPlan.shapeFor`), so no per-day data had to be written.

| Weeks | Mon | Tue / Thu / Fri / Sat | Wed | Sun |
|---|---|---|---|---|
| 2–11 | shadow (7 steps) | speak (5) | vocab (4) | review (2) |
| 12 | shadow | speak | vocab | **speak** (there is no review) |
| 1 | shadow | speak; Fri is rhythm | vocab | review |

A detector that finds nothing is only worth something if it can find something, so it was first checked against deliberate faults (undefined text, a raw key, an empty screen); all three were caught.

## What the renderer cannot see: content that is still Week 1's

1. **The baseline prompt is one fixed string** (`dlp.try_prompt`): “Introduce yourself in a few sentences…”, on every day of every week. Week 9's baseline asks for a self-introduction instead of a leadership update.
2. **The Learn step's sentence brief** (`DLP_SENT_ANGLE.learn`) says “Each sentence introduces this person or their work”, for every week.
3. **The offline conversation** (`dlpScenarioLocal`) is the same three talking points every day. Only the AI path is week-specific, and the AI paths need a sign-in.
4. **Every Weeks 2–12 Listen step offers two `clip-index` passages**, the kind pulled from Week 1 on rights grounds. `docs/WEEK1_CLIP_APPROVAL.md` records Weeks 2–11 as “held, untouched, unreviewed”.
5. **Week 12 does not fit the recipe on three days.** Mon: “Repeat a clip from Week 1 … compare with your Week 1 recording” needs the Week 1 clip assignment, which is paused. Sat: four recordings. Sun: a dashboard in the Reviews tab.

## What enabling it displaces

`rSession` checks `dlpOn` **before** the V2 mission path. Lifting the limit for a week therefore replaces that week's mission flow (guided and real missions, the Executive Polish coach report), which is built and tested for all 12 weeks (`tests/mission-*.mjs`). That is a product decision, not a side effect, and it is why weeks are opened one at a time in staging.

## Per week

| Week | Theme | Days built / valid / curriculum-valid | Listen passages | Step problems |
|---|---|---|---|---|
| 1 | Introductions, role clarity & speech baseline | 7/7 · 7/7 · 7/7 | 0 each day | none found |
| 2 | Project updates & status communication | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 3 | Problems, blockers & escalation | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 4 | Clarifying, asking questions & confirming | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 5 | Explaining technical work to non-technical stakeholders | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 6 | Recommendations & decision language | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 7 | Disagreeing professionally & pushing back | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 8 | Sprint meetings, blockers & stakeholder coordination | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 9 | Leadership-style summaries | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 10 | Interview & networking communication | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 11 | Persuasion & stakeholder influence | 7/7 · 7/7 · 7/7 | 2 each day | none found |
| 12 | Final integration week | 7/7 · 7/7 · 7/7 | 2 each day | none found |
