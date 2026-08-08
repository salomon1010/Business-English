# BE Mastery — Full Version 2 Audit (2026-08-06)

> Scope: audit only. No application code was modified, no deployment was made.
> Basis: the code as it stands on branch `feature/professional-tracks` at commit
> `d4c2d72`, read directly. Where a document and the code disagree, the code is
> treated as the truth and the document is listed as drift.
>
> Method: the repository skill guides (`skills/*.md`) were used as review lenses —
> product designer, chief product officer, UX reviewer, learning designer,
> conversation designer, AI coach, gamification, welding domain expert, prompt
> engineer, architecture reviewer — and their findings synthesised into one
> assessment rather than reported separately.
>
> **Revision 2 (2026-08-06).** A second verification pass was run against the
> source. Four numeric claims in revision 1 were overstated and have been
> corrected; the security and privacy findings were strengthened by new
> evidence; five minor findings were added. Every correction is logged in
> Appendix C. No structural finding was withdrawn.

---

## 1. Executive Summary

BE Mastery is not yet one AI Career Readiness Platform. It is a well-built
General English application with a Version 2 career layer bolted on top of it,
and the seam is visible from the first screen.

The Version 2 work is real and in places good: a shared curriculum-pack contract,
a track context, a competency log, an adaptive recommender, a voice-first
simulation screen and a Career Dashboard all exist and all run. But three things
are true at once, and they are what this audit is about.

**First, the career layer is a shell over the old product.** Home now says
"Today's mission · 25 minutes" and offers one button, "Continue Today's Mission".
That button lands on `rSession` — the unchanged 25-minute worksheet: a timer, a
collapsible checklist, a script textarea, a recorder, a posture coach, a notes
box, a 1–10 self-score and a "mark complete" button. Nothing on that screen
mentions the mission, the workplace, the character or the destination the
learner just read about. The promise made on Home is not kept on the next
screen. This is the single most important product problem in the audit.

**Second, the evidence model does not survive inspection.** Every competency
score in the product is a running total of activity points divided by a fixed
maximum. `CompetencyEngine.score()` has no notion of how well anything was done.
Ticking a session complete awards 2 professionalism + 1 technicalKnowledge.
Tapping "mastered" on a phrase you were never asked to say awards 3 vocabulary +
2 confidence + 1 safety. Those numbers are then rendered as "Career Readiness
42%", as "Interview readiness 38%", as a "Career Gap Analysis", and as a
milestone literally titled **Career Ready**. Two Welding competencies — QA/QC and
Blueprint Reading — have no activity mapping at all, so they are rendered on the
Professional Skills Passport as permanent 0% bars. Separately,
`ConversationOrchestrator.feedback()` manufactures six scores from word counts,
including a literal constant `pronunciation: 70`, writes them into local state on
every spoken turn, and never displays them. The product's own Vision 2 document
forbids exactly this. The code does it anyway.

**Third, Version 2 is English-only.** All seven Version 2 modules —
`career-center.js`, `adaptive-learning-engine.js`, `learning-coach.js`,
`professional-skills-passport.js`, `professional-simulation-engine.js`,
`conversation-orchestrator.js` and the new `rHome` / `rSimulation` code in
`index.html` — contain **zero** calls to `t()`. The app ships 15 translation
files at perfect key parity (1,184 keys × 15), and every new career surface
bypasses them. The stated primary audience includes Francophone Africa. A
French-speaking welder in Douala gets a fully localised English course and an
entirely English career platform.

Alongside those, the Experience Layer 1 change silently deleted working features:
`homeDueCard`, `homeWeekStrip`, `homePanelDashboard`, `homeMetrics`,
`homePanelRules` and — importantly for the business — `rateHTML` are now
unreachable. The Google Play rating prompt no longer renders anywhere in the app.

**Two risks outrank everything else in this document**, because they are live now
and neither depends on the product redesign:

1. **The AI endpoint is caller-programmable** (§16 P1). `backend/polish-worker.js`
   accepts an arbitrary 4,000-character system prompt from the client and runs it
   on the owner's OpenAI key. The only gate is an `Origin` header any non-browser
   client sets freely, plus per-IP counters that are per-isolate in a
   multi-isolate runtime and therefore far weaker than their nominal values.
2. **Sensitive learner content syncs without adequate disclosure** (§16 P3–P4,
   P11). Conversation transcripts, extracted facts and the Career Center résumé
   are written into `S` and pushed to Firestore as `JSON.stringify(S)`, while
   `privacy.html` makes three *exhaustive* claims — an enumerated sync list, "these
   are every case", and "none of these requests carry your name… or your practice
   history" — that the code contradicts. Browser speech recognition, a Google
   cloud service on Chrome and the simulation's only ASR path, is disclosed
   nowhere and is described in §2 of the policy as the *offline* fallback.

Both are Small-to-Medium effort and should ship before the mission redesign.

**The verdict.** The architecture is sound enough to carry the vision; do not
rewrite it. The content is thin, the evidence claims are unearned, the mission is
a label rather than a flow, and the two voice engines behave differently. Fix the
mission flow and the evidence model before adding a single new track, region or
feature.

### Scorecard

| Question from the brief | Verdict |
|---|---|
| 1. Does the learner immediately understand what to do? | **Yes on Home, no thereafter.** One clear CTA; the destination contradicts it. |
| 2. Do they understand why it matters professionally? | **Partly.** Home states "Why it matters"; no other screen does. |
| 3. Does every page support the current mission? | **No.** Only Home. Session, Shadow, Phrase Lab, Vocabulary, Practice, Progress carry no mission context and no return path. |
| 4. Is voice conversation intuitive and consistent? | **Intuitive within a screen, inconsistent across them.** Two independent voice engines with different turn rules and different evidence quality. |
| 5. Are coaching/readiness claims evidence-backed? | **No.** Participation counters are presented as competence and readiness. |
| 6. Motivating without being childish? | **Mostly yes.** Tone is adult. But achievements unlock on trivial taps and a milestone is named "Career Ready". |
| 7. Visually clear, modern, emotionally engaging? | **Home yes. Profile, Progress and Career Center no** — three pages that each repeat the same readiness number and the same recommendation. |
| 8. Too much text? | **Yes**, on Profile, Progress, Career Center and the simulation catalogue. |
| 9. Overwhelmed by choices? | **Yes** below Home: 6 bottom-nav destinations, 2 conversation systems, 12 scenarios × 5 characters = 60 undifferentiated entry points. |
| 10. Workplace journey or school? | **School.** Nav reads "12 Weeks / Weeks / Reviews / Practice". Journey is weeks and days. Sessions are marked complete like homework. |
| 11. Realistic for African users, local and international? | **Partially.** Offline-tolerant SW and low-bandwidth thinking are genuinely good. Onboarding roles are office-worker roles; destinations are generic; Version 2 is English-only. |
| 12. Architecture maintainable for future tracks? | **Yes with debt.** The pack contract is real. The engine still hardcodes Welding. |
| 13. Privacy, safety, evaluation, accessibility responsible? | **No.** An open LLM proxy, undisclosed data flows, no evaluation harness, one `aria-live` in the whole app (set to `off`). |
| 14. What to simplify/merge/hide/rewrite/remove? | See sections 18–21. |

---

## 2. Current Product Reality

### 2.1 What actually exists

| Layer | File | Lines / size | State |
|---|---|---|---|
| Application | `index.html` | 10,493 lines, 715 KB | HTML + CSS + all view code, inline |
| Track context | `professional-tracks.js` | 74 | Working, frozen config objects |
| Curriculum packs | `curriculum-provider.js` + `tracks/{general,welding}/*.json` | 6 sections/track | Working, `schemaVersion:"1"` validated |
| Competency log | `competency-engine.js` | 55 | Working; scoring is a point counter |
| Passport views | `professional-skills-passport.js` | 27 | Working; English-only |
| Coach | `learning-coach.js` | 110 | Working; English-only; fires a modal per award |
| Adaptive engine | `adaptive-learning-engine.js` | 78 | Working; English-only; forecasts are invented |
| Simulation engine | `professional-simulation-engine.js` | 58 | Working; fallback script is Welding-day-one hardcoded |
| Live orchestrator | `conversation-orchestrator.js` | 44 | Working; fabricated feedback metrics |
| Career Center | `career-center.js` | 34 | Working; English-only; six static destinations |
| Backend | `backend/polish-worker.js` | ~450 | Live; `chat` path is an open proxy |
| Service worker | `sw.js` | 120, `be12-v192` | Precache list misses 7 of 9 engine scripts |

All JavaScript parses cleanly (`node --check` on all nine modules, `new Function`
on all four inline `<script>` blocks: 0 errors). There is **no `package.json` and
no test runner** anywhere in the repository. `TESTING.md` is a manual checklist
that still describes the pre-Version-2 dashboard ("Continue where you left off",
"Progress ring shows % of 84 sessions") — screens that no longer exist.

### 2.2 The two tracks are not comparable products

| Content | General English | Welding |
|---|---|---|
| Weeks / stages | 12 | 12 |
| Sessions | 84 | 84 |
| Phrases | **152** | **24** |
| Vocabulary words | (derived corpus) | **24** |
| Shadow resources | 5 | **2** |
| Shadow starters | 18 | **3** |
| AI mentors | (multi-category) | 12 (one category) |
| Simulations | 0 | 12 (5 shared objective ids) |

A learner who switches to Welding — the track the product now leads with — moves
to roughly one-sixth of the language content. Twelve stages of curriculum are
supported by 24 phrases and 24 words. Stage 7 is "Blueprint Reading"; there is no
blueprint vocabulary pack behind it.

### 2.3 Version 2 removed working features without replacing them

`rHome` was rewritten to the Career Dashboard. Six functions it used to call are
now unreachable from any code path:

| Orphaned | What the learner lost |
|---|---|
| `homeDueCard()` | The green "N words are ready to review" card — the only spaced-repetition prompt outside the Practice tab. |
| `homeWeekStrip()` | The weekly 6-day goal strip. |
| `homePanelDashboard()` / `homeMetrics()` / `statCard()` | The nine-metric panel and the single contextual next-step line. |
| `homePanelRules()` | The method explainer. |
| **`rateHTML()`** | **The Google Play rating prompt. It is now unreachable — `rateGo` and `rateLater` are alive but nothing renders the card.** |

The nav badge still counts due words, so a learner sees a red badge on Practice
with no explanation anywhere else in the app.

---

## 3. Product Vision Alignment

Vision 2 states nine Version 2 objectives. Measured against the code:

| Objective | Status | Evidence |
|---|---|---|
| Learners perceive career preparation from the first screen | **Met** | `rHome` leads with profession, destination, workplace, milestone, mission. |
| One understandable next professional action | **Met on Home only** | Every other surface offers 3–8 competing actions. |
| Every significant activity connects to workplace communication | **Not met** | Session, Shadow, Phrase Lab, Vocabulary and Grammar have no mission context. |
| Career Readiness reflects transparent, evidence-based growth | **Not met** | Readiness is a weighted average of activity counters (§13). |
| AI coaching is personal, concise, useful, honest | **Not met** | Fixed five-category modal on every award; identical prose regardless of activity. |
| Simulations feel like a workday, not a questionnaire | **Not met** | Opening line names the scenario title and asks "how you would approach this situation". |
| General English remains fully functional | **Partly met** | Functional, but it lost Home features (§2.3) and now sees Welding-shaped language. |
| New professions plug in through validated packs | **Partly met** | Pack contract is real; the engine still branches on `id==='welding'` in five places. |
| Teams can explain why each feature improves outcomes | **Not met** | No evaluation harness, no analytics on the new surfaces, no research. |

The Vision 2 Career Readiness Philosophy says explicitly: *"Do not imply that a
learner is employable, certified, or safe to perform technical work solely from
app activity."* `adaptive-learning-engine.js` defines a milestone at readiness 75
titled **"Career Ready"** with the description *"Demonstrate consistent workplace
communication and readiness."* That milestone is reachable entirely by ticking
sessions complete and self-marking phrases. This is a direct contradiction
between the constitution and the code.

---

## 4. Learner Journey Assessment

### 4.1 The intended journey vs. the built one

Intended: `Career Journey → Current Mission → Targeted Preparation → Voice
Conversation → Evidence-Based Debrief → AI Coach → Professional Milestone → Next
Mission`

Built:

```
Home (Career Dashboard)  ──"Continue Today's Mission"──▶  rSession worksheet
                                                          │
                                                          ├─ optional one-tap jump (Mon/Wed/Thu/Sat/Sun only)
                                                          │   Thu → roleplay,  Sat → simulation
                                                          │   (both labelled "Open Phrase Lab" — see F-17)
                                                          └─ "Mark complete" ──▶ Coach modal ──▶ back to session

Practice tab ──▶ "Professional Interview Coaches" ──▶ (redirect) ──▶ Simulation catalogue
                                                                       │
                                                                       └─ 12 scenarios × 5 characters
                                                                          └─ sim-1 only: Mission briefing ──▶ voice ──▶ mission complete ──▶ debrief
                                                                          └─ sim-2..12: straight into voice ──▶ debrief
```

There is no loop. The debrief's "Choose another interviewer" returns to the
catalogue, not to the mission. Nothing returns the learner to Home's mission.
`SESS_RETURN` provides a "back to your session" breadcrumb, but only when the
learner arrived via a session link — not from the Practice tab, the coach modal
or the adaptive recommendation.

### 4.2 Day 1

A new learner completes five onboarding steps: name, **role**, goal, daily slot,
language. The role options are `["Engineering / Data", "Product / PM", "Finance /
Business", "Sales / Marketing", "Student", "Other"]` — office-worker roles from
the original product. **There is no profession step and no track choice in
onboarding.** The default track is General English. A welder must find
Professional Tracks inside a collapsed `<details>` at the bottom of Home, or via
a header chip. The product's flagship audience is not asked who they are.

### 4.3 Day 2 (returning learner)

Home restores the correct track and the correct day. This works and is a genuine
strength. But the learner cannot get back to Home from the mobile bottom nav
(§10.2) — the only route is tapping the logo in the top bar.

### 4.4 Week 1

By day 7, the learner has ticked seven sessions complete. `Career Readiness` reads
roughly 8–12%. They have possibly never spoken to a character, because the
simulation is only reachable from the Practice tab or a Thursday/Saturday session
link. Adaptive recommendation logic (`recommendation()`) checks vocabulary due
first, then "no simulation history" second — so the simulation is only ever
recommended once the learner has zero words due, which for an active learner is
rarely true.

---

## 5. Page-by-Page Audit

Legend for the decision column: **P**reserve · **S**implify · **R**edesign ·
**M**erge · **D**emote · **X** Remove.

### 5.1 Home — Career Dashboard (`rHome`, index.html:4314)

| | |
|---|---|
| Primary purpose | Show one professional next step |
| User question | "What should I do today?" (stated verbatim as the H1) |
| Primary action | Continue Today's Mission |
| Strengths | Genuinely one CTA. Four context facts are compact and relevant. "Why it matters" line is the only place in the app that explains professional purpose. Track switching correctly demoted to a closed disclosure. |
| Weaknesses | **CTA lands on a screen that contradicts it.** 100% hardcoded English. Mission title is `"${stage} · ${day.focus}"` — a concatenation, not a mission name. Coach recommendation duplicates content that reappears on Profile, Progress and Career Center. Milestone label is derived from a fabricated readiness number. |
| Cognitive load | Low — the best on the app |
| Text density | ~110 words. Appropriate. |
| Visual hierarchy | Strong. One card, one button. |
| Emotional effect | Positive; feels like a workplace brief |
| Career value | High |
| Learning value | Low (it is a router) |
| Accessibility | Facts grid collapses to one column below 390px — good. No landmark change; heading order fine. |
| Mobile | Good, except **no bottom-nav route back here** |
| **Decision** | **P** the layout, **R** the destination it points at |

### 5.2 Professional Track selection (`rTracks`, index.html:4493)

| | |
|---|---|
| Purpose | Choose a profession |
| Strengths | Localised (`t()` used throughout). Coming-soon tracks correctly disabled and disclosed. Theme per track. |
| Weaknesses | Reachable only from Home's collapsed disclosure or the header chip. Eight "coming soon" tracks advertise a roadmap the repository cannot deliver — Welding alone has 24 phrases. Switching tracks silently changes what "84 sessions", "Career Readiness" and every stat on Profile mean, with only a toast. |
| Text density | Low. Fine. |
| **Decision** | **P**, but move the choice into onboarding and cut the coming-soon list to two |

### 5.3 Journey / Professional Journey (`rJourney`, index.html:4525)

| | |
|---|---|
| Purpose | Show progression |
| Strengths | Phase segmentation avoids showing 12 units at once. Welding correctly renders "Stage 1 — Entering the Workshop". |
| Weaknesses | Nav labels it "12 Weeks" (desktop) / "Weeks" (mobile) even in Welding, where the content says Stage. The professional heading and subtitle are hardcoded English **and hardcoded to Welding**: `"…progress through your welding career."` will be shown verbatim to an Electrician track. Cards show day-dots — a school metaphor. |
| Cognitive load | Medium; 4 phase tabs + 3–4 cards + 7 dots each |
| **Decision** | **S** — one label vocabulary per track, drop day-dots for professional tracks, remove the hardcoded "welding" string |

### 5.4 Session / "Today's Mission" (`rSession`, index.html:4583)

| | |
|---|---|
| Purpose | Deliver the daily activity |
| User question | Should be "What am I practising for today?" — is currently "What are all these boxes?" |
| Primary action | Ambiguous. Nine interactive regions compete. |
| Strengths | The recorder, transcript and self-score work. Contextual `sessGo` jump is the right idea. |
| Weaknesses | **This is the mission and it does not know it.** No mission name, no character, no workplace, no objectives, no return to Home. Nine regions: timer, checklist, phrases, example script, recorder + posture coach, transcript, notes, self-score, mark-complete. "Mark complete" is a self-report that awards competency points. |
| Cognitive load | **Highest in the app** |
| Text density | ~450 words plus 5 free-text areas |
| Emotional effect | Homework |
| Career value | Low as rendered |
| Learning value | Medium — the content is fine, the framing is not |
| **Decision** | **R** — this is the Version 2 sprint (§25) |

### 5.5 Workplace Scenarios catalogue (`rSimulation`, no id, index.html:7082)

| | |
|---|---|
| Purpose | Choose a workplace situation |
| Strengths | `<details>` collapse keeps the first view scannable. Character choice is explicit and voice-first. |
| Weaknesses | Twelve scenarios that are functionally identical: all 12 share the same five objective ids, the same five characters, and the same hardcoded fallback dialogue. Expanded, each card carries duration + difficulty + stage + skills chips + 5 objectives + a character chain + 5 "Talk to X" buttons ≈ 60 entry points. `difficulty` and `duration` are invented in `simCardProfile` (`index<4?"Beginner":…`), not authored. All English. |
| Cognitive load | High when expanded |
| Text density | ~90 words per expanded card × 12 |
| **Decision** | **S** heavily — surface only the scenario the current stage points at, plus "browse all" |

### 5.6 Mission Briefing (`simMissionBriefing`, index.html:7076)

| | |
|---|---|
| Purpose | Set the scene before the conversation |
| Strengths | **The best screen in Version 2.** Company name, welcome, objectives as a checklist, a location chain, named first contact, one button. This is what a mission should feel like. |
| Weaknesses | It exists for exactly one scenario (`isFirstDayMission` → `welding-sim-1`). "12 minutes / Beginner / First day" are hardcoded in the template, not read from data. "Rewards: Confidence, Workshop Vocabulary, Communication, Career Readiness" promises competencies before any evidence exists. All English. |
| **Decision** | **P and generalise** — make it the mission shell for every scenario and every track |

### 5.7 Voice Conversation screen (`rSimulation` with a run)

Detailed in §6. Layout decision: **P**. Behaviour: **R**.

### 5.8 Talking Points (`.rp-pts` `<details>`)

| | |
|---|---|
| Purpose | Orient without scripting |
| Strengths | Collapsed by default — correct. Progress chip `n/5` is honest. |
| Weaknesses | The labels are the objective labels, which are also the scoring keys, which are also keyword-matched. So they read as a checklist to be completed, which is exactly the questionnaire feel the brief wants removed. Keyword matching means saying the word "safety" ticks "Discuss safety" regardless of what was said. |
| **Decision** | **S** — keep the panel, decouple the wording from the scoring keys |

### 5.9 Conversation Debrief (`rSimulation` with `debrief`)

| | |
|---|---|
| Purpose | Turn the conversation into learning |
| Strengths | **Correctly refuses to score when there is no speech** (`learnerTurns > 0` gate) and says so plainly. That is the single best evidence decision in the codebase. The mission block distinguishes words captured / phrases used / grammar coaching / next mission. |
| Weaknesses | When there *is* speech, six percentages appear that are arithmetic on keyword counts (§13.3). Grammar coaching is one hardcoded regex, `/\bworked welding\b/`. "Today's new words" are matched against a six-word list and are **not saved to the learner's vocabulary** — the loop the brief describes does not close. |
| Text density | High |
| **Decision** | **R** the scores, **P** the evidence block, **S** the layout |

### 5.10 Shadow Studio (`rShadow`)

| | |
|---|---|
| Purpose | Model authentic delivery |
| Strengths | Mature, well-built, clip marking + transcript + waveform + per-word playback. Honest about the lack of word timing in-browser. |
| Weaknesses | Welding has **2 resources and 3 starters** for 12 stages. No mission context, no return path, no "this is the clip for today's mission". Every dense screen renders third-party YouTube artwork. |
| **Decision** | **P** the tool, **M** into the mission as a preparation step, **fill the content gap** |

### 5.11 Phrase Lab (`rPhrases`)

| | |
|---|---|
| Purpose | Give usable workplace language |
| Strengths | 152 General phrases, well categorised. Executive Polish is genuinely differentiated. |
| Weaknesses | `phMaster(k)` — a self-declared "mastered" toggle — awards 3 vocabulary + 2 confidence + 1 safety points with no production of any kind. This is the cheapest path to a competency score in the product. Welding has 24 phrases. No mission filter. |
| **Decision** | **S** + **R the award**: mastery must require a spoken attempt |

### 5.12 Vocabulary (`rLibVocab` inside Practice)

| | |
|---|---|
| Purpose | Retain and reuse language |
| Strengths | Real spaced repetition (`vocState`, `VOC_INTERVALS`), learner-controlled saving, nav badge. |
| Weaknesses | The mission never feeds it. Words heard in a simulation are listed in the debrief and discarded. The Home due-card is now dead code, so the badge has no explanation outside Practice. Welding curriculum vocabulary is 24 words behind a `<details>`. |
| **Decision** | **P**, **M** with mission capture (with learner approval — the correct pattern already exists in `vocSave`) |

### 5.13 Grammar (`rLibGrammar`)

| | |
|---|---|
| Purpose | Fix recurring errors |
| Strengths | Exists; drives `S.gram` runs. |
| Weaknesses | Entirely decontextualised. The coach's only grammar statement is a binary: *"Grammar practice is in motion…"* or *"No grammar signal yet…"* — the same two sentences for every learner forever. In-conversation grammar coaching is one regex. |
| **Decision** | **D** — demote to a Practice sub-tab; contextual correction belongs in the debrief |

### 5.14 Practice hub (`rPractice`)

| | |
|---|---|
| Purpose | Independent drilling |
| Strengths | Due-words card here is correct and explained. Group/sub-tab structure is clear. |
| Weaknesses | The mixed shelf the previous audit already flagged: 2 group tabs × 3–5 sub-tabs + 3 knowledge boosters + 1–2 conversation entries. Hardcoded English in the professional branch. For Welding, the "Professional Interview Coaches" card routes to a screen that immediately redirects to the Simulation catalogue — the label and the destination disagree. |
| **Decision** | **S** — one row per activity type, mission-linked first |

### 5.15 Progress / Reviews (`rReview`, index.html:8135)

| | |
|---|---|
| Purpose | Show growth |
| Weaknesses | Stacks, in order: `progressHTML` → `Passport.growth()` (readiness bar + 6 competency bars + achievements + weekly points + recent activity) → `LearningCoach.weeklyCard` (achievements + strength + growth area + **readiness %**) → `AdaptiveLearningEngine.growthCard` (**career readiness %** + **interview readiness %** + retention % + 6 more bars) → `rpMetricsHTML` → 12 week tabs → 2 sub-tabs → 10 self-score sliders → 4 textareas → monthly checkpoint. **Career readiness appears three times on one page**; competency bars appear twice with different maxima. Desktop nav calls it "Reviews", mobile calls it "Progress". |
| Cognitive load | Very high |
| Text density | Very high |
| Emotional effect | A report card |
| **Decision** | **R** — one evidence timeline, one readiness statement, self-review behind a tab |

### 5.16 Professional Skills Passport (`professional-skills-passport.js`)

| | |
|---|---|
| Purpose | A professional snapshot |
| Strengths | Compact, one card, clear track and stage. |
| Weaknesses | Headline number is `readiness` (§13). Renders **ten** Welding competency bars, of which **QA/QC and Blueprint Reading can never move** — no activity maps to them. English-only. Rendered on Profile; a near-duplicate `growth()` renders on Progress. |
| **Decision** | **R** to an evidence card; **X** the unearnable bars until they have a source |

### 5.17 Profile (`rProfile`, index.html:8376)

| | |
|---|---|
| Purpose | Identity and account |
| Weaknesses | Twelve stacked blocks: hero, 3 stats, Passport (13 bars), coach narrative, adaptive roadmap (milestone + 3 facts + 3 chips + recommendation + CTA), 84-cell heatmap, 3 menu rows, month calendar, year contribution graph, performance overview, share card, invite card, certificate card. Readiness appears **three** times here too. Two activity calendars (`calHTML` month/year + `heatmapCard` 84-day) show overlapping data from different sources. |
| Cognitive load | Very high |
| **Decision** | **R** — identity + evidence + account. Move the roadmap to Progress, delete one calendar. |

### 5.18 Career Center (`rCareer` → `career-center.js`)

| | |
|---|---|
| Purpose | Destination preparation |
| Strengths | Disclaimers are present and correctly worded ("educational career preparation only… confirm current employer, licensing, and legal requirements"). Six destinations. The Resume coach is a real, useful idea. |
| Weaknesses | Opens with two big percentages — career readiness and interview readiness — before any guidance. "Career Gap Analysis" relabels activity counters as career gaps. Destination content is three static paragraphs per destination, identical in structure and largely interchangeable; nothing is welding-specific, Cameroon-specific or verified. `pack()` deliberately hides the simulation button for non-General tracks, so the Welding learner's Career Center offers a coach but not a scenario. English-only. |
| Text density | High (~600 words) |
| **Decision** | **S** and **D** — guidance first, evidence second, no percentages at the top |

### 5.19 Destination selector

Six chips, stored as `S.careerCenter.destination`, shown on Home as "Current
destination". It changes three paragraphs of prose and nothing else — not the
curriculum, not the characters, not the interview style, not the vocabulary.
**Decision: P the concept, S the promise** — do not surface it on Home as a
"current destination" until it changes something.

### 5.20 Certification guidance

Three sentences per destination, all correctly hedged, all correctly telling the
learner to verify. This is the right posture. **Decision: P.** It should not grow
without qualified review.

### 5.21 Resume Coach

A textarea posted to the same `POLISH_API` endpoint as Executive Polish. Real
value. Two problems: the learner's professional history — employers, years, roles
— is sent to OpenAI and is **not covered by `privacy.html`**, which describes only
"the sentence you type or dictate" for Executive Polish; and the text is stored in
`S.careerCenter.resume`, which is synced verbatim to Firestore. **Decision: P,
with a privacy fix (F-21).**

### 5.22 AI Coach (`learning-coach.js`)

Detailed in §12. **Decision: R.**

### 5.23 Adaptive recommendations (`adaptive-learning-engine.js`)

| | |
|---|---|
| Strengths | Explainable, local, deterministic, offline. `recommendation()` returns a reason string. Good design. |
| Weaknesses | Fires a hard priority ladder: due words → first simulation → pronunciation < 75 → weakest competency. An active learner almost always has due words, so the simulation is recommended once, if ever. `prediction().estimate` invents a forecast — *"3 focused weeks at your recent pace"* — from `remaining / max(1, sum of positive weekly changes)`. With one week of data the denominator is 1, so the estimate is simply "the number of readiness points remaining, in weeks". It is displayed on Home, Profile and the Career Center. |
| **Decision** | **P** the recommender, **X** the time estimate |

### 5.24 Career readiness indicators

Six surfaces render a career-readiness percentage: Passport, Passport growth,
coach weekly card, adaptive roadmap, adaptive growth card, Career Center. All from
`CompetencyEngine.readiness()`. **Decision: R to one canonical statement, shown once.**

### 5.25 Milestones & achievements

`MILESTONES` at 0/25/50/75/90 → Professional Foundation, Clear Communicator,
Workplace Contributor, **Career Ready**, **Interview Ready**. Welding achievements:
`safety-beginner` unlocks at safety score ≥ 3, which is **three** Phrase Lab
self-marks (`phrase_lab` awards `safety: 1`, and score equals the point count).
`interview-beginner` at interview ≥ 3 is **exactly one** completed AI conversation
(`ai_conversation` awards `interview: 3`). `professional-speaker` at communication
≥ 10 is two conversations. None of these requires evidence of quality; the
cheapest two require no speech at all. **Decision: R** (§11).

### 5.26 Settings (`rSetup` / `rData`)

Mature, localised, keyboard-operable. Reminder, language, theme, account, backup,
export. **Decision: P.**

### 5.27 Help (`rManual`)

Fetches `manual/<code>.html` in 15 languages, with search and icon conversion.
Contains **no Version 2 content** — no mission, no track, no simulation, no
Passport, no Career Center. **Decision: P the system, update the content.**

### 5.28 Navigation

| Surface | Items | Problem |
|---|---|---|
| Desktop top bar | brand · track chip · 12 Weeks · Phrase Lab · Shadow · Practice · Reviews · Profile · timer · streak | "12 Weeks" is wrong for Welding stages |
| Mobile bottom nav | Weeks · Shadow · Phrase Lab · Practice · Progress · Profile | **No Home.** The Version 2 primary screen has no persistent mobile entry point. Labels differ from desktop ("Progress" vs "Reviews", "Weeks" vs "12 Weeks"). |

**Decision: R** — Home must be the first bottom-nav item, and the six destinations
should collapse to four (Home · Journey · Practice · Profile).

### 5.29 PWA and offline behaviour

`sw.js` is thoughtful: network-first with a **3-second timeout that falls back to
cache** and an explicit comment about Orange/MTN Cameroon 3G. This is the best
piece of market-aware engineering in the repository.

But the `SHELL` precache array lists only `curriculum-provider.js` and
`professional-tracks.js`. The other **seven** Version 2 modules —
`competency-engine.js`, `learning-coach.js`, `professional-simulation-engine.js`,
`conversation-orchestrator.js`, `adaptive-learning-engine.js`, `career-center.js`,
`professional-skills-passport.js` — are not precached, and `activate` deletes the
entire old cache on every version bump. A learner who installs, or who first opens
after a deploy while on a dead connection, loads an app whose Passport, coach,
roadmap, Career Center and simulations are all absent. The `window.X ?` guards mean
it degrades rather than crashes — the learner simply sees a Home card with a
generic fallback coach line and a Profile with missing sections, and no error.

Additionally, both conversation systems require the network: `rpListen` returns
early with "need online" if `!navigator.onLine`, and the simulation depends on
browser `SpeechRecognition`, which is a cloud service on Chrome. **"Offline-first"
is true of the course and false of the career layer.**

**Decision: R the SHELL list (Small effort, high value).**

---

## 6. Voice Conversation Audit

### 6.1 There are two voice engines, not one

| | Professional coach conversation (`rpStart`/`rpListen`) | Workplace simulation (`simVoiceToggle`/`simVoiceListen`) |
|---|---|---|
| Capture | `MediaRecorder` → blob → Worker → Whisper | Browser `SpeechRecognition` |
| Turn end | Tap (Welding) / 30s silence window (General) | Tap (Welding) / recognition end (General) |
| Audio retained | Yes — enables real per-word pronunciation grading (`fbAssess`) | No |
| Offline | Refuses ("need online") | Fails silently to "unavailable in this browser" |
| Transcript UI | Scrolling bubble thread | Single prompt bubble |
| Feedback | Real, audio-based, per-word scores | Fabricated arithmetic |
| Character source | `aiMentors` (12) | `simulationCharacters` (5) |
| Prompt | `rpAI()` system prompt | `ConversationOrchestrator.prompt()` |

A Welding learner meets both. On Thursday the session sends them to a coach
conversation with a scrolling chat thread and real pronunciation grading. On
Saturday it sends them to a simulation with one bubble and invented scores. Same
product, same voice, two different experiences and two different truth standards.

The brief says: *do not introduce a duplicate voice engine.* One already exists.
**Consolidating on the `MediaRecorder` + Whisper path is the correct direction** —
it is the only one that produces gradeable evidence, it works identically on iOS
and Android, and the code comment at index.html:9134 documents exactly why the
browser recogniser was abandoned for role-play (Android duplicate finals, iOS
silent failure after a few turns). The simulation screen still uses that
recogniser.

### 6.2 The opening prompt is not a workplace line

`ProfessionalSimulationEngine.start()`:

> *"I'm Maya, the HR Recruiter. We're working through Safety Stop-Work
> Conversation. Could you begin by telling me how you would approach this
> situation?"*

Three problems in one sentence. It names the scenario title aloud — nobody at work
announces the title of the conversation. It asks a hypothetical ("how you *would*
approach") rather than putting the learner in the moment. And the HR recruiter
opens a stop-work safety conversation. This is a questionnaire wearing a name tag.

A workplace opening for that scenario is Priya, the safety officer, saying:
*"You flagged something on line two. Tell me what you saw."*

### 6.3 The offline fallback is the wrong scenario for eleven of twelve

`ProfessionalSimulationEngine.reply()` is a hardcoded first-day script:

- turn 1 → supervisor: *"What type of welding work are you comfortable supporting today?"*
- not-yet-`safety` → *"Before you begin, tell me how you would prepare the area and your PPE"*
- not-yet-`onboarding` → *"Are you ready to complete onboarding and join the team?"*
- end → *"Welcome aboard. You have completed the first-day conversation."*

Whenever the API is unreachable — offline, rate limited, 502 — a learner running
"Quality Issue Report" or "Welding Interview" is welcomed aboard and onboarded.
Given `rateLimited` is 15/min per IP on a shared African mobile NAT, this fallback
will be seen.

### 6.4 The twelve scenarios are one scenario

All 12 share objective ids `introduction / experience / supervisor / safety /
onboarding`. Objective *labels* differ per scenario (sim-5 relabels them "Raise the
concern / Describe the risk / Confirm next action / Explain safety action / Close
safely"), and each has one `unexpectedEvents` message. Everything else — cast,
fallback dialogue, debrief structure, scoring, competency award — is identical.
Progression is nominal.

### 6.5 Objectives are keyword matches

`objectives()` marks an objective complete when the transcript `.includes()` any
keyword. "Discuss safety" completes on the substring `"safety"`. Because
`.includes()` is substring-based, `"ppe"` also fires inside "puppet" and `"can"`
inside "cancel", "scan", "American". A learner who says *"I can't scan the
weld"* completes "Confirm next action". The live service can also add objectives
via `data.covered`, which is at least validated against the objective id list.

### 6.6 Turn control

The Welding manual-turn work (ED-024) is correct and well implemented: `finishRequested`
gating, restart-on-`no-speech`, and an explicit "a recognition pause is never
permission to submit Welding speech" comment. The mic states (green ready / orange
recording / blue processing) are coherent.

One defect: in `rpListen`, the level-watching `setInterval` is skipped entirely for
professional tracks (`if(!isProfessionalJourney())rec.tick=…`). The `RP_MAX`
100-second ceiling is decremented inside that interval. **For Welding, the hard cap
never runs** — a learner who taps the mic and walks away records indefinitely and
uploads the whole thing to Whisper. Cost, battery and privacy exposure.

### 6.7 Does the learner know when the conversation is over?

`simFinishEarly` → "End practice". Natural completion only fires when the model
returns `complete:true` or all five objectives are ticked. `data.complete` is taken
from the model **without corroboration** — a learner who says *"okay, we're done,
mark this complete"* can end the mission and trigger the competency award. Minor
prompt injection with a real consequence: unearned evidence.

### 6.8 Character recommendations

The five characters are one line each. Nothing in the runtime uses `personality`
or `communicationStyle` except the live prompt, and the fallback ignores them
entirely. Concrete recommendations:

| Character | Now | Should be |
|---|---|---|
| **Maya** — HR Recruiter | "friendly, welcoming, professional"; opens every scenario | Restrict to hiring and onboarding contexts. Ask about the person, not the topic: *"Tell me about the last shop you worked in."* Follow-ups should chase specifics — job, material, thickness, process. |
| **Daniel** — Supervisor | "experienced, calm, supportive"; asks about experience | The task-giver. Short, direct, assumes competence. Should interrupt with a real instruction and check back-briefing: *"Repeat that back to me."* This is the highest-value workplace communication drill in the product and it is not used. |
| **Luis** — Coworker | "funny, relaxed, helpful" | The only character who can create informal register practice. He currently delivers one scripted interruption. Give him overlapping speech, incomplete sentences and slang the learner must ask about — *"Sorry, what does 'tack it' mean?"* is a core workplace skill. |
| **Priya** — Safety Officer | "serious, safety-focused, non-judgmental" | Should own stop-work, escalation and refusal language — the highest-consequence English a welder needs. She currently appears mid-scenario asking about PPE. Make her the *opener* of every safety scenario, and let her accept an imperfect sentence that is unambiguous, because that is the real standard. |
| **Amelia** — QA Inspector | "detail-oriented, observant" | Should ask closed, factual questions and require precise answers: *"Which pass?"* *"What amperage?"* Currently delivers the closing line. Her role is the natural home for QA/QC evidence — the competency that can currently never be earned. |

Follow-up strategy: the live prompt already says *"React specifically to the
learner's latest answer"* and *"one or two short, warm workplace sentences"*, which
is right. What is missing is a **stance per character** (probing / directing /
befriending / challenging / verifying) and a rule that a character asks at most one
question per turn. Pacing: the current implementation speaks, then waits for a tap
— good. Do not add timers.

Unexpected events: one per scenario, fired by turn number. They are the only source
of surprise and they work. Increase to two or three per scenario and make at least
one require the learner to *say no* or ask for help — the hardest speech act for a
non-native professional, and entirely absent today.

### 6.9 Does it feel like work or like a test?

Like a test, for four reasons: the opening names the scenario; the talking points
double as the score sheet; the debrief awards percentages per skill; and the whole
thing sits under a tab called "Practice". The mission briefing screen (§5.6) proves
the team knows how to fix this. Generalise it.

---

## 7. Learning Effectiveness Audit

### 7.1 The loop, step by step

| Step | Built? | Reality |
|---|---|---|
| Mission briefing | Partially | One scenario only (`welding-sim-1`) |
| Shadow preparation | No | Shadow has no mission context; Welding has 2 clips |
| Phrase preparation | No | No mission filter on Phrase Lab |
| Vocabulary preparation | No | No mission filter; 24 Welding words |
| Voice conversation | Yes | Two engines (§6) |
| Micro-coaching | Barely | One hardcoded regex, `/\bworked welding\b/` |
| Debrief | Yes | Honest when empty; fabricated when not |
| Review | Weak | Progress is a report card, not a review |
| Spaced repetition | Yes, but disconnected | Words from conversations never enter it |
| Next mission | Text only | "Next mission: Shift Handover" is a preview string with no link |

**The loop does not close.** Nothing that happens in a conversation becomes
reviewable material.

### 7.2 Where the product teaches, tests, coaches, records — and where it confuses them

| Behaviour | Where it genuinely happens |
|---|---|
| **Teaches** | Shadow Studio, Phrase Lab, curriculum vocabulary, Help centre |
| **Tests** | Flashcards, quizzes, crosswords, grammar drills, pronunciation grading |
| **Coaches** | Speaking feedback (`fbAssess` — real, audio-grounded), role-play pronunciation review |
| **Motivates** | Streak, calendar, achievements, milestones |
| **Records participation** | `S.days`, `S.dates`, `S.dayLog`, `CompetencyEngine.logs` |
| **Captures evidence** | Session recordings (on device), role-play audio turns, simulation transcripts |
| **Treats participation as competence** | **Every competency score, career readiness, interview readiness, gap analysis, milestone and the Career Ready label** |

The last row is the failure. It is not a labelling problem — it is that the
calculation has no other input.

### 7.3 Does the learner get a second attempt?

Yes: `simRestart` repeats the scenario, and Shadow/role-play both allow repeats.
But nothing compares attempt 2 to attempt 1. Vision 2's fourth evidence level —
**Growth** — is defined in the document and implemented nowhere.

### 7.4 Teach-back

Not used. The single highest-value technique for workplace safety English —
"repeat the instruction back to me" — appears nowhere. Daniel is the natural
vehicle.

### 7.5 Is professional knowledge separated from English improvement?

No. `technicalKnowledge` is awarded 1 point for `professional_coach` (which is the
activity type fired by **ticking a session complete**) and 2 points for a
simulation. A learner accrues "Technical Knowledge" by checking boxes. For a
safety-critical trade this is the most dangerous confusion in the product.

---

## 8. Career and Global Readiness Audit

### 8.1 What is supported

- Local employment preparation: partially — the language is generic workplace English, which transfers.
- International interview prep: partially — 12 "interview" mentor conversations exist.
- Workplace integration: yes, in intent.
- Safety communication: present as a topic, thin as content.
- Certification awareness: correctly hedged, three sentences per destination.
- Resume/LinkedIn: one textarea + polish.
- Cross-cultural communication: **not supported**. There is no content on indirectness, hierarchy, or how a Cameroonian welder's deference norms read to a Canadian foreman — which is the actual communication risk.
- Practical weld-test preparation: **not supported and should not be**, see §9.

### 8.2 Claims that need attention

| Claim | Where | Problem | Fix |
|---|---|---|---|
| Milestone **"Career Ready"** | `adaptive-learning-engine.js:MILESTONES` | Reachable from checkbox activity. Reads as an employability statement. | Rename to *"Practice Portfolio Complete"* or similar; require demonstrated evidence |
| **"Interview Ready"** at 90% | same | Same | Same |
| **"Career readiness N%"** | 6 surfaces | Implies a single collapsed judgement | Replace with an evidence statement |
| **"Career Gap Analysis"** | Career Center | Relabels low activity counts as career gaps | Rename to "What to practise next" |
| **"Estimated Time: 3 focused weeks"** | Adaptive roadmap, Home, Career Center | Invented | Remove |
| **"Rewards: … Career Readiness"** | Mission briefing | Promises readiness for starting a conversation | Remove that reward |
| **"Requirements vary by province…"** | Career Center Canada | Correct and well hedged | Preserve |

### 8.3 Five things that must not collapse into one number

The brief is right to name these. Current state:

| Dimension | Currently measured? | Should be |
|---|---|---|
| Communication readiness | Partly (activity counts) | The only thing the app may claim, and only from spoken evidence |
| Technical knowledge | "Measured" by checkbox | **Not measurable here.** Remove the competency or restrict it to *vocabulary used in context* |
| Verified certification | No | Never. Signpost only. |
| Legal eligibility | No | Never. Signpost only. |
| Employer qualification | No | Never. |

Recommendation: the Passport should show **one** headline — *"Communication
practice evidence"* — with an explicit line stating that it does not assess
technical skill, certification or eligibility.

### 8.4 Regional realism

No stereotypes or unsupported generalisations were found in the destination
content — the six entries are bland but safe. The gaps are:

- Nothing is Cameroon- or Nigeria-specific beyond a paragraph.
- Nothing addresses the actual first barrier: **accent intelligibility under PPE and machine noise**, which is where an African welder is most often misjudged on a North American site.
- Onboarding roles are office roles (§4.2).
- The five characters have no African representation, and no francophone-accented interlocutor exists to practise with.

---

## 9. Welding Authenticity Audit

Reviewed against `skills/welding-domain-expert.md`, which correctly constrains this
guide to *communication* and explicitly excludes WPS/PQR, qualification and
site-specific safety advice.

### 9.1 What is authentic

- The **stage sequence** is credible: workshop entry → team → equipment → materials → safety → procedures → drawings → construction → QA → industrial → interviews → career. That maps to how a shop actually inducts someone.
- The **character set** is right: HR, supervisor, coworker, safety officer, QA inspector are the five people a new welder actually talks to.
- The **stop-work scenario** exists at all, which most language products omit.
- Terminology used is correct where it appears: MIG, TIG, stick, root pass, fabrication, PPE, inspection, blueprint. Nothing in the 24-word vocabulary is wrong.

### 9.2 What is generic

- Every scenario resolves to introduction / experience / safety / onboarding. "Drawing Clarification" and "Quality Issue Report" do not require a drawing or a defect.
- "Skills developed" chips are the first three objective labels, auto-derived in `simCardProfile`. They are not authored claims.
- `difficulty` is `index < 4 ? "Beginner" : index < 8 ? "Intermediate" : "Advanced"` — position in an array, not judgement.
- The keyword lists that drive objectives are language-general, not trade-specific.

### 9.3 What is technically shallow

- **24 vocabulary words** for a 12-stage trade curriculum. A first-week shop vocabulary is closer to 150 terms — consumables, joint types, positions (1G–6G), preheat, interpass, undercut, porosity, spatter, purge, tack, bevel, fit-up, distortion, WPS, hold point.
- **Stage 7 Blueprint Reading** has no symbol vocabulary. Weld symbols are the single most language-dense thing a welder reads, and they are the reason "blueprintReading" was made a competency. There is no content behind it.
- **Stage 9 QA/QC** likewise has no defect vocabulary and no NDT terminology, and its competency can never be earned.
- **Pipeline / oil and gas** appear in the product positioning and nowhere in the content.
- **Employer qualification tests** are not represented. This is correct and should stay correct — see 9.5.

### 9.4 What needs correcting or varying

| Item | Issue | Recommendation |
|---|---|---|
| `capture()` regex `/experience\|worked\|year\|mig\|tig\|stick\|fabricat/` | `stick` matches "stick around", "chopstick"; `year` matches "yearly" | Tighten or drop — it drives what is quoted back to the learner |
| Mission phrase `"I usually perform..."` | Not natural shop English | *"I usually run…"* / *"I mostly do…"* |
| Grammar correction `"I worked on welding projects."` | Fine but singular | Needs a reviewed list; one regex is not a grammar system |
| PPE framing | Generic ("helmet, gloves") | Varies by country and site; keep it about *communicating* PPE status, never about what PPE to use |
| Stop-work language | Present as a scenario, absent as taught phrases | Authoring priority: the exact sentences that stop a job safely and non-confrontationally |

### 9.5 The boundary that is currently held, and must stay held

The product does **not** claim that spoken answers prove welding competence, and
`simulation` debriefs speak about communication. That is correct. Two things
threaten it: the competency named **Technical Knowledge**, which is awarded for
checkbox completion, and the milestone **Career Ready**. Both should change.

**All Welding content in this repository requires review by a qualified welding
professional before promotion**, particularly anything added for blueprint
reading, QA/QC, procedures or safety escalation. That review has not happened and
is not recorded anywhere.

---

## 10. UX and Visual Design Audit

### 10.1 Density and repetition — measured

| Page | Blocks | Readiness % shown | Competency bars | "Recommended activity" CTAs | Words (approx.) |
|---|---|---|---|---|---|
| Home | 3 | 0 (milestone label only) | 0 | 1 | 110 |
| Journey | 3 | 0 | 0 | 0 | 90 |
| Session | 9 | 0 | 0 | 0–1 | 450 |
| Practice | 6 | 0 | 0 | 0 | 300 |
| Simulation catalogue | 12 collapsibles | 0 | 0 | 60 (5 per card) | 1,100 expanded |
| Progress | 8 | **3** | **12** | 1 | 900 |
| Profile | 12 | **3** | **13** | 1 | 800 |
| Career Center | 6 | **2** | 4 | 2 | 600 |

Career readiness is rendered **eight times** across three pages. The same
"recommended next activity" appears on Home, Profile, Progress, Career Center and
inside every coach modal.

### 10.2 Specific text reduction targets

Not "reduce text" — here is what to cut, where.

**Profile — target 800 → 300 words, 12 blocks → 6**

| Element | Action |
|---|---|
| Passport `bar("Career Readiness")` + `psp-score` headline | **Merge into one** evidence statement |
| Passport `bar("Current Stage")` | **Remove** — the stage is named on the line above |
| QA/QC + Blueprint Reading bars | **Remove** until earnable |
| `LearningCoach.narrativeCard` | **Remove from Profile** — it repeats the coach card |
| `AdaptiveLearningEngine.roadmapCard` | **Move to Progress** |
| `AdaptiveLearningEngine.heatmapCard` (84 cells) | **Remove** — `calHTML` already renders a month heat-map and a year graph from the same activity |
| "Estimated Time" fact | **Remove** (invented) |
| Share card + invite card + certificate card | **Collapse into one** "Share your progress" disclosure |
| Menu rows (Career Center / Settings / Help) | **Keep visible** |

**Progress — target 900 → 350 words**

| Element | Action |
|---|---|
| `Passport.growth()` readiness bar | **Remove** — keep one readiness statement per app |
| `coach.weeklyCard` readiness cell | **Remove** |
| `growthCard` career + interview readiness | **Remove**; keep vocabulary retention, which is real |
| 12 competency bars across two cards | **Collapse to one card, max 5 bars** |
| Self-score sliders + 4 textareas | **Progressive disclosure** behind "Weekly reflection" |
| Week tab row (12 tabs) | **Replace** with the current stage + a "previous stages" chevron |

**Career Center — target 600 → 250 words**

| Element | Action |
|---|---|
| Two readiness percentages at the top | **Remove** — lead with the destination |
| Three prose paragraphs per destination | **Convert to chips + one sentence each**, expandable |
| "Career Gap Analysis" heading + intro paragraph | **Cut the paragraph**, rename the heading |
| Resume Coach intro | **Shorten to one line** |

**Simulation catalogue — target 1,100 → 250 words in first view**

| Element | Action |
|---|---|
| Two intro paragraphs | **One line** |
| duration / difficulty / stage meta | **Chips** |
| "Skills developed" chips | **Remove** (auto-derived, not authored) |
| "Workplace story" character chain | **Keep** — it is the one genuinely evocative element |
| 5 "Talk to X" buttons per card | **One "Start" + "choose who" as a second step** |

**Session — target 450 → 200 words in first view**

| Element | Action |
|---|---|
| Mission header (new) | **Add** ~30 words: workplace, objective, who you will speak to |
| Timer + hint + reset | **Merge** to one control |
| Example script textarea | **Collapse** by default |
| Posture coach | **Demote** behind the recorder |
| Notes + transcript + self-score | **Move below** the completion action |

### 10.3 What must remain visible everywhere

Active track · current mission name · one primary action · a way home.

### 10.4 What should become icons, chips or tooltips

Duration, difficulty, stage, destination, phase — all currently prose or facts
grids, all should be chips. Competency definitions and the readiness method should
be a tooltip/disclosure, not body text. Objective status should be a chip count,
not a list, until the learner opens it.

### 10.5 Visual identity

Amber-on-charcoal for Welding is applied correctly through `:root[data-track="welding"]`
with a light-theme variant. It reads as professional and is distinct from the
blue-violet General identity. Two problems: the class that applies it inside the
simulation is named **`simulation-blue-mode`** while its rules set amber
(`#f6c453`) — a maintenance trap; and track identity is absent from the mission
briefing, debrief and Career Center, so the learner leaves the track's visual
world halfway through the journey.

### 10.6 Emotional design

The Home dashboard and the mission briefing achieve the intended register: calm,
adult, purposeful. Progress and Profile undo it — a wall of percentage bars reads
as assessment, not as a professional record. The blueprint document's *"quiet
pride"* is achievable; it needs evidence statements, not meters.

### 10.7 Responsiveness

Touch targets have a 44px floor via a global media query; the bottom nav uses 52px.
`.career-dashboard-grid` collapses to one column at 390px. `.sim-cast` and
`.psp-grid` were not verified at 320px and should be. The horizontal `cat-tabs`
row of 12 week tabs on Progress will scroll off-screen on a small phone.

---

## 11. Gamification Audit

### 11.1 What is right

- No leaderboards, no public ranking, no fake urgency, no mascot.
- Streak is framed as a training log; the header pill shows a number without pressure.
- Achievements are named after professional moments ("Workshop Ready", "First Conversation").
- Reduced-motion is honoured globally.

### 11.2 What is wrong

| Issue | Detail |
|---|---|
| Achievements unlock on trivial actions | `safety-beginner` at safety ≥ 3 = **three** Phrase Lab self-marks, no speech. `workshop-ready` = **one** ticked session. `vocabulary-starter` = 3 vocabulary reviews. `professional-speaker` at communication ≥ 10 = two conversations. |
| Points are the currency, and points are participation | Every award is a fixed integer from `activityMappings`. Nothing scales with quality. |
| Milestones are readiness thresholds | So the milestone inherits every problem the readiness number has. |
| "Rewards" promised before evidence | Mission briefing lists Career Readiness as a reward for starting. |
| Coach modal after every award | Including after ticking a phrase. It is a five-panel dialog. This is the closest thing to a dark pattern in the app — an interruption that celebrates nothing. |
| `consistency` is 5% of readiness and is `dates.length * 5` | 20 active days = 100% consistency, permanently. |

### 11.3 Recommended professional progression model

Replace points with **evidence tokens**, one per demonstrated moment, each with a
date and a source:

```
Stage 1 — Entering the Workshop
  ◆ Introduced yourself to Maya            2026-08-04   spoken · 38s · transcript kept
  ◆ Explained your experience to Daniel    2026-08-05   spoken · 52s
  ◇ Raised a safety concern with Priya     — not yet
  ◇ Repeated an instruction back           — not yet
  → Stage complete when 4 of 4 moments have spoken evidence
```

Rules:

1. A token requires **learner speech**. No speech, no token. (The debrief already
   enforces this — extend the rule everywhere.)
2. A milestone is **a named set of tokens**, so it is always explainable.
3. Repeating a moment adds a second token and enables a **growth** comparison —
   the missing fourth evidence level.
4. The streak stays as-is.
5. Delete the percentage scores, or move them behind a "how this is calculated"
   disclosure with the honest label *"activities completed"*.

---

## 12. AI Coach Audit

The ideal, per the brief: one celebration, one evidence-backed improvement, one
next activity, one reason. Current output, from `LearningCoach.summary()`:

```
What you did well:        "You added evidence in Vocabulary and Confidence."
Communication:            "Keep building clear messages through short, focused speaking turns."
Vocabulary:               "You used a vocabulary-building activity."
Grammar:                  "No grammar signal yet—notice one sentence pattern in your next practice."
Confidence:               "You took an active confidence-building step."
Professional communication:"Connect your next English activity to a real professional situation."
Recommended improvement:  "Focus next on pronunciation."
[Start recommended activity →]
```

| Criterion | Verdict |
|---|---|
| One specific celebration | **No** — it names competency *labels*, not what the learner did |
| One evidence-backed improvement | **No** — "focus next on X" where X is simply the lowest counter |
| One next activity | **Yes** |
| One reason why it matters | **No** |

Specific failures:

- **Five fixed panels regardless of activity.** The same grid appears after a shadow session, a phrase tap and a full workplace conversation.
- **Two grammar sentences exist in total.** `grammarSignal()` returns one of two strings for the lifetime of the account.
- **The improvement is always the lowest counter**, so it is stable for weeks and repeats identically.
- **The narrative is a template**: *"you have completed N recent professional learning activities. X is your strongest evidence so far; your next growth opportunity is y."*
- **Memory is three fields** (`lastFocus`, `lastActivity`, `lastSummaryId`, `lastReadiness`). It cannot say *"last week you struggled to describe your experience; today you did it in one sentence"* — which is what "personal" means.
- **It never reads a transcript.** The learner's actual words exist in `simRun.messages` and `rpConv.turns` and the coach never touches them.
- **Duplicated four ways**: coach card (Home), narrative card (Profile), weekly card (Progress), modal (after every award).
- **Dead code**: `weakest()` contains `filter(x => x.id!=="professionalism" || true)` — always true, the filter does nothing.
- **English only.**

**Recommendation.** Cut the coach to one card with exactly four sentences,
generated from evidence: what you said (quote a real phrase from the transcript),
what worked, one thing to change, one next action with a reason. Remove the modal;
put the summary at the top of the surface the learner returns to. Remove the
narrative and weekly cards, or make them a monthly retrospective that quotes the
learner's own past and present words.

---

## 13. Evidence and Evaluation Audit

**This is the section that should drive the next sprint.**

### 13.1 Every learner-facing metric, traced to source

| Metric | Source | Method | Measures | Confidence | Misleading? | Recommendation |
|---|---|---|---|---|---|---|
| **Communication %** | `CompetencyEngine.score` | Σ points ÷ 100 | Participation | None | **High** | Replace with count of spoken moments |
| **Vocabulary %** | same | Σ points ÷ 100 | Participation | None | **High** | Replace with words retained (retention data is real) |
| **Pronunciation %** (Passport) | same | Σ points ÷ 100 | Participation | None | **High** | Replace with `fbAssess` averages — real audio scores already exist in `S.fbHist` |
| **Confidence %** | same | Σ points ÷ 100 | Participation | None | **High** | Remove — not measurable |
| **Professionalism %** | same | Σ points ÷ 100 | Participation | None | **High** | Remove or make it a demonstrated-moment count |
| **Technical Knowledge %** | same; awarded by *ticking a session* | Σ points ÷ 100 | Participation | None | **Critical** | **Remove.** Safety-critical trade. |
| **Safety %** | same; awarded by a Phrase Lab tap | Σ points ÷ 100 | Participation | None | **Critical** | **Remove**; replace with "safety moments practised" |
| **QA/QC %** | no activity maps to it | Always 0 | Nothing | — | **High** (implies failure) | **Remove from the Passport** |
| **Blueprint Reading %** | no activity maps to it | Always 0 | Nothing | — | **High** | **Remove from the Passport** |
| **Interview Readiness %** | `interview` competency, or `(communication+confidence)/2` | Counters | Participation | None | **High** | Replace with "interview conversations completed, with transcripts" |
| **Career Readiness %** | weighted average of the above + consistency | Weighted counters | Participation | None | **Critical** | **Replace with an evidence statement** |
| **Consistency** | `dates.length × 5` | Days opened | Participation | High (it is honest about what it is) | Low | Keep, relabel "active days" |
| **Estimated preparation time** | `remaining ÷ max(1, Σ positive weekly change)` | Invented | Nothing | None | **High** | **Delete** |
| **Debrief: communication/professionalism/confidence/vocabulary/grammar/industryReadiness** | `ProfessionalSimulationEngine.debrief` | Keyword and length arithmetic | Text surface features | None | **Critical** | Replace with objective coverage + a transcript quote |
| **Orchestrator feedback (6 metrics)** | `ConversationOrchestrator.feedback` | Word counts; `pronunciation` is the constant `70` | Nothing | None | **Critical** (stored, never shown) | **Delete the function** |
| **Speaking-feedback score** | `fbAssess` via Worker → audio model | Real per-word grading of actual audio | **Demonstration** | Good | No | **Preserve and promote** |
| **Role-play `overall` %** | `fbAssess` per turn, averaged | Real audio grading | **Demonstration** | Good | No | **Preserve and promote** |
| **Vocabulary retention %** | `reps >= 5` ÷ total | Spaced-repetition performance | **Growth** | Good | No | **Preserve** |
| **Streak / dates / dayLog** | activity dates | Days practised | Participation, honestly labelled | High | No | Preserve |

The pattern is stark: **the two metrics with a defensible method (`fbAssess`
pronunciation and vocabulary retention) are the two that Version 2 does not use in
the Passport, the readiness score, or the Career Center.**

### 13.2 Worked example of the failure

A learner opens the app for seven days, ticks each session complete, and taps
"mastered" on ten phrases. They have not spoken once. Recomputed from the actual
weights in `tracks/welding/progress.json`:

- `professional_coach` × 7 → professionalism +14, technicalKnowledge +7
- `phrase_lab` × 10 → vocabulary +30, confidence +20, safety +10
- `consistency` → min(100, 7 × 5) = 35

```
Vocabulary 30%   Confidence 20%   Professionalism 14%   Safety 10%
Technical Knowledge 7%
Communication 0%  Pronunciation 0%  QA/QC 0%  Blueprint Reading 0%  Interview 0%
Consistency 35%                          →  Career Readiness 13%
Achievements unlocked: Workshop Ready · Safety Beginner
Coach: "Professional Vocabulary is your strongest evidence so far."
```

Zero words were spoken. Vision 2 says: *"No speech, recording, transcript, or other
usable evidence means no performance score, competency award, or claim of
improvement."* The code produces a readiness figure, five competency scores and two
achievements.

*Revision-2 correction:* revision 1 stated ≈14% and three achievements including
*Vocabulary Starter*. The correct figures are 13% and two achievements —
`vocabulary-starter` requires `activity: vocabulary_practice`, and `phrase_lab` is
a different activity type. The finding is unchanged; the arithmetic is now exact.

### 13.3 Recommended evidence model

Replace scores with a four-level ledger that matches the Vision 2 table already
written:

```
Participation   activity completed              → count, dated, labelled "completed"
Production      audio or transcript exists      → count + duration + the artefact
Demonstration   a named objective was addressed → count + the quoted sentence
Growth          a repeat attempt improved       → the two artefacts, side by side
```

Rules to enforce in code:

1. `CompetencyEngine.logActivity` records the level alongside the activity type.
2. Only **Production** and **Demonstration** may appear in anything called
   readiness, competency or growth.
3. Nothing self-reported (session tick, phrase mastery, self-score) may create
   Production or Demonstration evidence.
4. A learner-facing readiness label may only be shown with the sentence that
   generated it. If it cannot be quoted, it cannot be shown.
5. Delete every fabricated metric listed in §13.1.

---

## 14. Architecture Audit

### 14.1 Strengths

- **The pack contract is genuine.** Six JSON sections per track, `schemaVersion` validated on load, frozen hydrated object, safe fallback to General when a pack is incomplete. A third track is a data exercise, not a code exercise — for curriculum.
- **`ProfessionalTrackContext`** is small, frozen and inheritance-aware.
- **Engines are separate files with frozen public objects** and no cross-imports beyond `window`. Dependency direction is clean: Passport → Competency → Curriculum → Track.
- **Activity log is bounded** (500 logs, 100 coach summaries, 50 debriefs, 20 feedback entries) with a deterministic `merge()` for cloud sync.
- **The service worker's 3-second network race** is a genuinely well-reasoned piece of engineering for the target market.
- **Secrets are server-side.** No API key in the repo.
- **All JS parses; i18n key parity is exact** (1,184 × 15).

### 14.2 Technical debt and coupling

| # | Issue | Severity |
|---|---|---|
| A1 | `index.html` is 10,493 lines / 715 KB containing every view, all CSS and the entire English dictionary. The engines were extracted; the views were not. | High |
| A2 | **The "shared engine" hardcodes Welding.** `professional-simulation-engine.js` `reply()` is a first-day-at-a-welding-workshop script. `capture()` regexes are welding terms. `ConversationOrchestrator.feedback()` counts `weld\|mig\|tig\|arc\|ppe`. `isFirstDayMission()` checks `id==='welding'`. A second profession inherits welding dialogue. | **Critical for scale** |
| A3 | Mission is not data. `missionData()` has hardcoded ABC Fabrication defaults; the briefing template hardcodes "12 minutes / Beginner / First day". Only `welding-sim-1` has a `mission` block. The changelog calls this "a reusable data-driven pattern" — it is one instance. | High |
| A4 | Two voice engines (§6.1). | High |
| A5 | `sw.js` SHELL omits 7 of 9 engine scripts. | High |
| A6 | Zero `t()` in all Version 2 code. | **Critical** |
| A7 | Dead code: 6 orphaned Home functions; `rpLibrary`'s professional branch is unreachable (`rRoleplay` redirects before it); `voiceFeedback` computed and stored, never read; `weakest()`'s always-true filter. | Medium |
| A8 | `simRefresh()` calls `go('simulation', id)` — a **full view re-render on every conversation turn**, which destroys and rebuilds the entire DOM subtree mid-conversation. Focus is lost, and it is why the recognition-error path previously replayed the opening prompt. | High |
| A9 | Label/route mismatch in `tracks/welding/weeks.json` `sessionLinks`: Thu → `roleplay` and Sat → `simulation` both use `"lk": "sess.link_phrases"` → the button reads "Open Phrase Lab". | Medium |
| A10 | `sessionLinks[*].wk` for Welding Thu/Sat contains raw English sentences passed through `t()`. They render (t falls through to the key) but can never be translated. | Medium |
| A11 | No schema validation beyond `schemaVersion==="1"`. A pack missing `competencyConfig.competencies` yields silent zeros. | Medium |
| A12 | No AI response contract validation beyond `reply` truthiness, cast-id membership and objective-id membership. `data.complete` is trusted. | High |
| A13 | No migration strategy. New state shapes (`competency`, `coach`, `simulations`, `careerCenter`) are created lazily by each engine with no version field on `S`. A future rename has no path. | Medium |
| A14 | `save()` is called on every state change and synchronously `JSON.stringify`s the whole of `S` — which now includes conversation transcripts — then pushes it to Firestore. | Medium |
| A15 | `simulation-blue-mode` class applies amber. | Low |
| A16 | No tests, no `package.json`, no CI. `TESTING.md` describes screens that no longer exist. | High |
| A17 | `go('session')` is handled by a wrapper (`index.html:8686`) that renders `rSession` into `#v-journey` — there is no `#v-session` div and no `session` key in the base router map. The wrapper works, but it skips `navBadges()`, `SESS_RETURN` handling and the `simulation-blue-mode` reset, so the amber track class persists onto the session screen when the learner arrives from a simulation. | Low |
| A18 | `const _views` (`index.html:8683`) is declared and never read. | Low |

### 14.3 Recommended incremental modularisation — no rewrite

1. **Extract the mission shell** (`mission.js`): resolve current mission from track
   data, render briefing, sequence steps, own the return path. Nothing else moves.
2. **Move the fallback dialogue into the pack.** Each simulation gets a
   `fallbackTurns` array. `reply()` becomes a pack interpreter. This is the single
   change that unhardcodes Welding.
3. **Delete `ConversationOrchestrator.feedback()`** and the `voiceFeedback` state.
4. **One voice module** (`voice.js`) exposing `startTurn/endTurn/onTranscript`,
   backed by `MediaRecorder` + Whisper, used by both conversation surfaces.
5. **Add `SCHEMA_VERSION` to `S`** and a `migrate(S)` function before anything else
   changes shape.
6. **Extract views last**, one per file, only when a view is being redesigned anyway.
7. **Add a minimal test runner** — `node:test` and a jsdom harness are enough to
   cover routing, track switching, empty-evidence gating and state migration.

### 14.4 Regression risks in the current state

- Any track added today inherits Welding dialogue (A2).
- Any `sw.js` bump wipes the engine scripts from cache (A5).
- Any change to `S` shape breaks returning learners silently (A13).
- The coach modal fires inside `awardCompetency`, which is called from seven places
  including a phrase toggle — any new award site inherits a full-screen dialog.

---

## 15. Accessibility and Inclusion Audit

### 15.1 Findings

| # | Issue | Severity |
|---|---|---|
| X1 | **The entire application contains one `aria-live` region, on the session timer, set to `aria-live="off"`.** The voice conversation status (`#simStatus`, `#rpStatus`, `#simMicLabel`) — "Your turn — tap the microphone", "Listening", "Thinking" — is never announced. A screen-reader user cannot tell when it is their turn to speak in a voice-first product. | **Critical** |
| X2 | The microphone button's accessible name is `aria-label="Speak"` and never changes between ready / recording / processing. There is no `aria-pressed`. | **Critical** |
| X3 | The full-screen conversation (`.rp-work`, `.sim-work`) is appended to `body` with `document.body.style.overflow="hidden"` but **no focus trap, no initial focus move and no `role="dialog"`**. Keyboard focus remains behind the overlay. | High |
| X4 | `simRefresh()` re-renders the whole view on every turn, destroying and recreating the focused element. | High |
| X5 | The AI's spoken line is rendered as text in `#simPrompt`, which is correct — but there is no transcript of the conversation on the simulation screen, so a deaf or hard-of-hearing user has only the current line. | Medium |
| X6 | Speech-recognition failure states are text-only and, for the simulation path, terminal ("Voice recognition is unavailable in this browser") with no alternative. There is no typed fallback anywhere — a deliberate decision (ED, Sprint 10) that excludes users who cannot use speech. | High |
| X7 | Accented speech: the recogniser is hardcoded `lang='en-US'` in `simVoiceListen`. For West African English this materially reduces accuracy — and a missed keyword silently fails an objective. The Whisper path handles accent far better, which is another argument for consolidating on it. | High |
| X8 | Users with speech differences (stammer, dysarthria) have no accommodation. The Welding manual turn helps; the General 30-second silence window does not. | Medium |
| X9 | Version 2 surfaces are English-only (§3), which excludes the francophone half of the stated audience. This is an inclusion failure, not only an i18n gap. | **Critical** |
| X10 | Colour: the CSS header comments record that `--acc` on the bottom nav measures 4.08:1, below AA, and that it is a known exception. Amber-on-charcoal was not re-verified for the new Version 2 components (`.career-dashboard-fact span`, `.sim-card-label`, `.psp-row span`). | Medium |
| X11 | Reduced motion is honoured globally with `!important`. **Good.** | — |
| X12 | 44px touch-target floor is enforced globally; bottom nav 52px. **Good.** | — |
| X13 | Low bandwidth: the 3s SW race is good, but the career layer requires the network for every conversation, and the engine scripts are not precached. | High |
| X14 | Older devices: `MediaRecorder` + `AudioContext` are feature-detected with fallbacks; `SpeechRecognition` is detected. Reasonable. | — |
| X15 | Literacy variation: the product is text-heavy (Session 450 words, Progress 900). For a learner whose written English lags their spoken English, the density is the barrier before the English is. | High |

### 15.2 Practical improvements, in order

1. Add `aria-live="polite"` to `#simStatus` and `#rpStatus`; add `aria-live="assertive"` for turn changes only.
2. Give the mic button a dynamic `aria-label` and `aria-pressed`, and announce state changes.
3. Add `role="dialog" aria-modal="true"`, move focus to the mic on open, restore on close, and trap Tab.
4. Stop full re-rendering mid-conversation — patch `#simPrompt`, `#simProg` and the status in place.
5. Set recogniser language from the learner's profile, and prefer the Whisper path.
6. Add a typed fallback for turn entry, available to everyone, not presented as the default.
7. Localise every Version 2 string.
8. Re-run contrast on the amber track tokens in both themes.
9. Cut Session and Progress text to the targets in §10.2.

---

## 16. Privacy and Safety Audit

| # | Issue | Severity |
|---|---|---|
| P1 | **`backend/polish-worker.js` `chat` path accepts a caller-supplied `system` prompt (up to 4,000 chars) and arbitrary messages**, and runs them on the owner's key. The Worker *does* enforce an explicit server-side origin gate — `if (!cors["Access-Control-Allow-Origin"]) return 403` — which is a real control and stops cross-site browser use. But `Origin` is a request header any non-browser client sets at will, and `ALLOWED_ORIGINS` includes `http://localhost:8000`. It is a gate, not authentication. `POLISH_API` is live at `index.html:7659`. `response_format: json_object` and `max_tokens: 400` narrow the output shape without preventing general-purpose use. | **Critical** |
| P2 | Rate limiting is per-IP **and per-isolate**: `chatHits` is a module-scope `Map`, and Cloudflare Workers run many isolates across many colos, so the nominal 20/min · 500/day is a local ceiling, not a global budget, and resets on recycle. Separately, learners in Cameroon and Nigeria share carrier-grade NAT at scale, so the per-IP limit throttles real users while barely inconveniencing an abuser with a proxy pool. The provider budget cap is the only true backstop — and when it trips, Polish, TTS, transcription, pronunciation grading and both conversation systems fail together. | High |
| P3 | **Simulation transcripts are persisted and synced.** `ConversationOrchestrator.remember()` writes `sim.messages` — verbatim spoken content, typically including real employer names and work history — plus `sim.facts` (extracted name and experience) into `S`. `save()` writes `S` to `localStorage` and `fbPush()` sends `JSON.stringify(S)` to Firestore with **no allow-list**. `S.convos[].lines[].text` (200 Whisper transcripts) and `S.coach.summaries` (100 records) go the same way. | **Critical** |
| P4 | **The Resume/LinkedIn Coach** sends the learner's professional summary — employers, roles, years — to the Worker → OpenAI, and stores it in `S.careerCenter.resume` → Firestore. `privacy.html` §4 covers "Executive Polish: the sentence you type or dictate"; it does not name a career-history field. | High |
| P11 | **The privacy policy makes three exhaustive claims the code contradicts.** §5 enumerates the sync scope as closed — *"What syncs is the progress data in section 1 — sessions, scores, notes, phrases, vocabulary"* — and reassures that *"your voice recordings are never uploaded"*, which is true of the audio blob and misleading about the transcript of it. §4 is headed *"These are **every case**, and what is sent"* and omits the professional simulation chat entirely. §4 closes with *"None of these requests carry your name, your account, or your practice history"* — **false** for the simulation chat, whose `transcript(sim)` payload characteristically opens with the learner stating their name and employment history. This is not an incomplete disclosure; it is an inaccurate one. | **Critical** |
| P12 | **Browser `SpeechRecognition` is an undisclosed third-party processor.** `simVoiceListen()` (`index.html:7143`) is the simulation's only ASR path, and on Chrome and Android WebView it streams audio to Google. `privacy.html` mentions it once (§2) and frames it as the *offline* fallback — *"If you are offline… the app falls back to your browser's own speech recognition"* — implying it is the private option. Google is named nowhere as a processor. The full path for a spoken workplace turn is: device → Google (ASR) → text → Cloudflare Worker → OpenAI → Firestore. | **Critical** |
| P5 | Live simulation state (`S.simulations.live`) is only cleared by `abandon()`, which runs on exit/complete/choose-another. A conversation left by navigating away persists indefinitely. No retention policy, no user-facing deletion for transcripts specifically. | Medium |
| P6 | `ConversationOrchestrator.feedback()` writes 20 fabricated metric objects per session into synced state. Pointless data collection. | Medium |
| P7 | **Prompt injection with a state consequence:** `data.complete` from the model is trusted and ends the mission, which triggers `awardCompetency`. A learner (or an injected string in a transcript) can induce completion. Cast id and objective ids *are* validated — good — but completion is not. | High |
| P8 | The system prompt is constructed client-side and sent to the Worker, so the prompt is fully visible to the user. Not a leak of secrets, but it means prompt hardening is unenforceable server-side. | Medium |
| P9 | Safety content boundary is correctly held: the app teaches how to *communicate* about safety and never instructs on procedure. `skills/welding-domain-expert.md` states the boundary explicitly. **Preserve this.** | — |
| P10 | Analytics remain anonymous, allow-listed and cookie-less, with no device ID. **Good.** No Version 2 event is instrumented, so there is no data on whether any of it is used. | Medium |

**Minimum privacy and security work before any promotion:**

1. Move prompts server-side behind named `promptId` values so the endpoint stops
   being caller-programmable; add a bearer credential (Turnstile or a short-lived
   signed token); move rate limiting to Durable Objects or KV so the counter is
   global; drop `localhost` from the production allow-list.
2. Replace the full-`S` sync with an explicit allow-list of synced keys, excluding
   `simulations.live`, `voiceFeedback` and `careerCenter.resume` by default.
3. Rewrite `privacy.html` §2, §4 and §5 to name simulation transcripts, the résumé
   field, and browser speech recognition as a Google service — and to remove the
   three exhaustive claims that are no longer true.
4. Bound transcript retention and add a "delete my conversations" control beside
   the existing export and reset.
5. Purge transcripts already written to Firestore, and re-check the Play Data
   Safety declaration against the corrected list.

---

## 17. Documentation Audit

25 markdown documents. Findings:

| Document | Status | Recommendation |
|---|---|---|
| `BE_MASTERY_VISION_2.md` | Current, coherent, correctly self-declared as the constitution | **Authoritative — keep** |
| `BE_MASTERY_EXPERIENCE_BLUEPRINT.md` | Current; the best articulation of intent in the repo | **Authoritative — keep** |
| `PRODUCT_AUDIT.md` | Accurate baseline; superseded in detail by this document | **Archive** (superseded, not wrong) |
| `VERSION2_ROADMAP.md` | Current | **Merge** into `IMPLEMENTATION_ROADMAP.md` |
| `IMPLEMENTATION_ROADMAP.md` | **Two documents in one file** — a Version 2 sprint log at the top, then the frozen per-screen UX redesign roadmap from 2026-08-02 with its own "Sequence" table and "Frozen screens" rules that Version 2 has already violated (Dashboard was frozen; Experience Layer 1 rewrote it) | **Split**: sprint log → `CHANGELOG.md`; screen roadmap → archive |
| `CHANGELOG.md` | Current, but **contains a false claim**: Sprint 10 says the Welding route "prioritizes the established Talk it out coach-card experience" — `rRoleplay` now redirects Welding to the simulation catalogue before that screen can render | **Update** |
| `ENGINEERING_DECISIONS.md` | Good, current, ED-001…ED-024 | **Authoritative — keep** |
| `docs/architecture/engineering-decisions.md` | **Empty duplicate** template of the above | **Delete** |
| `docs/architecture/01-system-overview.md` | Describes the **pre-Version-2 product**: "executive communication coach", "board updates", "meetings, stand-ups". Contradicts Vision 2's target user. | **Rewrite or archive** |
| `docs/architecture/02–15` | **Fourteen files containing headings only.** `11-evaluation-framework.md` is nine empty headings and two TODOs. | **Delete or fill.** Empty scaffolding is worse than absence — it implies governance that does not exist |
| `PRODUCT_VISION.md` | Superseded by Vision 2 | **Archive** |
| `UX_AUDIT.md` (36 KB) | Pre-Version-2 measurements | **Archive** |
| `UX_REDESIGN.md`, `INFORMATION_ARCHITECTURE.md`, `MISSION_FRAMEWORK.md`, `GAMIFICATION_SYSTEM.md`, `GLOBAL_EXPANSION.md`, `AI_COACH_GUIDE.md`, `CHARACTER_BIBLE.md` | Version 2 design notes, all authored 2026-08-05 | **Merge** into two: one product spec, one content/character spec |
| `DESIGN_SYSTEM.md`, `COMPONENT_LIBRARY.md`, `INTERACTION_SPECIFICATION.md` | Current and useful | **Keep** |
| `RELEASE_CHECKLIST.md`, `RETENTION_STRATEGY.md` | Pre-Version-2 but still broadly valid | **Update** |
| `TESTING.md` (root) | **Stale** — describes the removed Home dashboard | **Rewrite** |
| `CLAUDE.md` (root) | Accurate on infrastructure; **silent on the entire Version 2 architecture** — no mention of tracks, engines, missions or the Career Center | **Update** |
| `skills/*.md` (10) | Concise, well-scoped, consistent with Vision 2 | **Keep** |
| `.agents/skills/`, `.codex/skills/` | Third-party vendored skills, untracked, partially duplicating `skills/` | **Decide**: commit with `skills-lock.json` or gitignore |

**Missing entirely:** a content governance process (who reviews Welding content and
when), a testing document that matches the current app, an evaluation plan for AI
outputs, and an ADR for the two-voice-engine situation.

---

## 18. What to Preserve

Do not touch these without a reason:

1. **The empty-evidence gate in the simulation debrief.** `learnerTurns > 0` before any score or award, with an honest message. It is the correct pattern, already written, and should be extended everywhere.
2. **The mission briefing screen.** It is the design target for the whole product.
3. **The voice conversation layout** — character header, one spoken prompt, one mic, collapsible talking points, status line. Do not turn it into a chat interface.
4. **The Welding manual turn control** (tap to start, tap to submit, pause-safe).
5. **`fbAssess` pronunciation grading and the role-play word-by-word review.** The only demonstration-grade evidence in the product.
6. **Vocabulary spaced repetition and learner-controlled saving.**
7. **The service worker's 3-second network race** and its market reasoning.
8. **The curriculum pack contract**, `schemaVersion` validation and the General English fallback.
9. **Local-first state, device-held recordings, no mandatory account.**
10. **The 44px floor, the global reduced-motion rule, and the 1,184×15 i18n parity discipline.**
11. **Certification and destination disclaimers** as currently worded.
12. **Amber-on-charcoal Welding identity** and the blue-violet General identity.
13. **The analytics posture**: allow-listed, anonymous, cookie-less, no device ID.
14. **Vision 2 and the Experience Blueprint** as the product constitution.

---

## 19. What to Simplify

| Target | From | To |
|---|---|---|
| Profile | 12 blocks, 3 readiness figures, 13 bars, 2 calendars | 6 blocks, 1 evidence statement, 1 calendar |
| Progress | 8 blocks, 3 readiness figures, 12 bars | 3 blocks: evidence timeline, retention, reflection (disclosed) |
| Career Center | 6 sections, 2 percentages, 600 words | 4 sections, 0 percentages, 250 words |
| Simulation catalogue | 12 cards × 60 entry points | 1 recommended scenario + browse |
| Session | 9 regions, 450 words | Mission header + 4 regions, 200 words |
| Bottom nav | 6 destinations, no Home | 4: Home · Journey · Practice · Profile |
| Coach output | 5 panels + narrative + weekly + modal | 1 card, 4 sentences |
| Competency bars | 10 Welding competencies | 4–5 that can actually be earned |
| Achievements | 6 with trivial triggers | 4–5 tied to spoken moments |
| Destinations | 6 chips with 3 paragraphs each | 6 chips with 1 sentence + disclosure |

---

## 20. What to Redesign

1. **Session → Mission workspace.** The mission briefing pattern, then the day's steps as a short sequence, then the completion moment, then the return to Home. This is the Version 2 sprint.
2. **Evidence model.** Four levels, no fabricated scores, no readiness percentage (§13.3).
3. **The debrief.** Objective coverage + a quoted sentence the learner actually said + one thing to change + one next action. No per-skill percentages.
4. **One voice engine.** Consolidate on `MediaRecorder` + Whisper.
5. **The simulation fallback.** Move dialogue into the pack; delete the hardcoded first-day script from the engine.
6. **The coach.** Four sentences, transcript-grounded, one location.
7. **Mobile navigation.** Home first.
8. **Onboarding.** Add a profession step; replace office roles with trade/professional roles.
9. **Milestones.** Named evidence sets, not readiness thresholds. Rename "Career Ready".
10. **Localisation of Version 2.** Every new string through `t()`.

---

## 21. What to Remove or Demote

**Remove**

| Item | Reason |
|---|---|
| `ConversationOrchestrator.feedback()` and `S.simulations.live[*].voiceFeedback` | Fabricated, stored, never displayed |
| `prediction().estimate` ("N focused weeks") | Invented forecast, shown in 3 places |
| QA/QC and Blueprint Reading Passport bars | Cannot be earned; permanent 0% |
| Technical Knowledge and Safety competency **scores** | Awarded by checkbox in a safety-critical trade |
| `AdaptiveLearningEngine.heatmapCard` | Duplicates `calHTML` |
| `LearningCoach.narrativeCard` on Profile | Duplicates the coach card |
| Readiness figures on Progress and Career Center | Duplicates |
| The coach modal (`LearningCoach.present`) | Interrupts; celebrates participation |
| "Skills developed" chips on scenario cards | Auto-derived, not authored |
| Auto-derived `difficulty` in `simCardProfile` | Array position, not judgement |
| "Rewards: … Career Readiness" on the mission briefing | Promises evidence before it exists |
| Six orphaned Home functions | Dead code — but **restore `homeDueCard` and `rateHTML` first** (§23) |
| `docs/architecture/02–15` empty templates and `docs/architecture/engineering-decisions.md` | Imply governance that does not exist |
| Six of the eight "coming soon" tracks | Cannot be delivered at current content depth |

**Demote**

| Item | To |
|---|---|
| Grammar | A Practice sub-tab; contextual correction moves to the debrief |
| Weekly self-review (sliders + textareas) | Behind a disclosure on Progress |
| Share / invite / certificate cards | One "Share" disclosure on Profile |
| Destination selector | Inside Career Center only, until it changes behaviour |
| Posture coach | Below the recorder |
| Executive Polish | Keep, but stop presenting it as a peer of the mission |

---

## 22. Critical Risks

| ID | Risk | Severity | Surface | Learner impact | Business impact | Technical risk | Correction | Effort | Depends on | Research? |
|---|---|---|---|---|---|---|---|---|---|---|
| **R-01** | Participation is presented as competence and as "Career Ready" | **Critical** | Passport, Progress, Profile, Career Center, Home | Learner believes they are prepared when they have not spoken | Trust collapse on first real interview; unsupportable claims in any B2B or funder conversation | Touches every readiness call site | Implement the four-level evidence model; delete fabricated metrics | **Large** | — | No |
| **R-02** | Version 2 is English-only | **Critical** | All new surfaces | Francophone audience excluded from the career layer | The stated primary market cannot use the flagship feature | Mechanical but wide (~250 strings) | Route every string through `t()`, extend the 15 packs | **Medium** | String freeze | No |
| **R-03** | **Caller-programmable AI endpoint.** Arbitrary system prompt accepted; gated only by a forgeable `Origin` header and per-isolate counters | **Critical** | `backend/polish-worker.js` `fetch`/`callChat` | When the budget cap trips, every AI feature fails at once | Provider spend; generated content attributable to Lomonec's OpenAI account | Worker and client must ship together | Server-side `promptId` templates; bearer credential; global rate limiting; drop `localhost` from production | **Medium** | Worker deploy | No |
| **R-04** | **Transcripts and résumé synced without accurate disclosure.** Full `S` pushed to Firestore; policy makes three exhaustive claims the code contradicts; Google ASR undisclosed | **Critical** | `ConversationOrchestrator.remember` → `save()` → `fbPush`; `CareerCenter.polish`; `simVoiceListen`; `privacy.html` §2/§4/§5 | Personal work history leaves the device after being told it does not | Play Data Safety and GDPR Art. 13 records currently inaccurate | Small code change; policy needs review | Allow-list the sync payload; rewrite the three policy sections; bound retention; add per-transcript deletion; purge existing cloud copies | **Small–Medium** | Legal review | No |
| **R-05** | Voice-first product with no live regions and no focus management | **Critical** | Both conversation screens | Screen-reader users cannot participate at all | Accessibility complaint risk; excludes users | Contained | Add live regions, dynamic mic label, dialog semantics, stop re-rendering | **Small** | — | No |
| **R-06** | Home's CTA lands on a screen that contradicts it | **Critical** | Home → Session | Confusion at the exact moment the product makes its promise | Activation and D2 retention | The main sprint | Mission workspace | **Large** | Mission schema | Yes — validate the mission framing with 5 target users |
| **R-07** | The shared engine hardcodes Welding dialogue | **High** | `professional-simulation-engine.js` | An Electrician learner is welcomed to a welding workshop | Blocks track expansion, which is the business model | Moderate | Move fallback turns into packs | **Medium** | Pack schema v2 | No |
| **R-08** | Engine scripts not precached; conversations require network | **High** | `sw.js`, both voice paths | Career layer silently missing on a poor connection | Undermines the offline-first promise in the target market | Small | Extend SHELL; add explicit offline states | **Small** | — | No |
| **R-09** | Two voice engines with different truth standards | **High** | Roleplay vs simulation | Inconsistent experience; only one produces real evidence | Doubles maintenance | Moderate | Consolidate on MediaRecorder + Whisper | **Medium** | R-01 | No |
| **R-10** | `data.complete` trusted from the model | **High** | Orchestrator | Learner can end a mission and collect an award by asking | Evidence integrity | Small | Require objective coverage or an explicit end action | **Small** | — | No |
| **R-11** | Welding content is one-sixth of General English | **High** | All Welding surfaces | The flagship track is the emptiest | Retention on the track being marketed | Content, not code | Author 120+ terms, 60+ phrases, 8+ clips, with qualified review | **Large** | Domain reviewer | No |
| **R-12** | Play rating prompt unreachable | **High** | Home | None | Direct loss of store ratings, which drive install rate | Trivial | Re-render `rateHTML()` on Home | **Small** | — | No |
| **R-13** | `RP_MAX` cap does not apply to Welding turns | **High** | `rpListen` | Battery and data burn on a metered connection | Whisper cost per minute | Trivial | Apply the cap regardless of track | **Small** | — | No |
| **R-14** | No tests, no CI, stale test doc | **High** | Repository | Regressions reach the learner | Every sprint is riskier than the last | — | `node:test` + jsdom for routing, track switch, evidence gating, migration | **Medium** | — | No |
| **R-15** | Session-link labels contradict destinations (Thu/Sat say "Open Phrase Lab") | **Medium** | Session | Learner does not trust navigation | Minor | Trivial | Add correct i18n keys | **Small** | — | No |
| **R-16** | No `S` schema version or migration path | **Medium** | State | Silent data loss on a future change | Support burden | Contained | Add `S.v` + `migrate()` before further changes | **Small** | — | No |
| **R-17** | Objective matching is naive substring | **Medium** | Simulation | False positives and false negatives on objectives | Evidence quality | Small | Word-boundary matching; prefer model-reported coverage | **Small** | — | No |
| **R-18** | Onboarding has no profession step; office-worker roles | **Medium** | Onboarding | The target user is not recognised | Activation | Small | Add a profession step | **Small** | Track list | Yes — light |
| **R-19** | Documentation drift (empty architecture set, contradictory system overview, false changelog claim) | **Medium** | `docs/` | None directly | Decisions made from stale documents | — | Archive, merge, delete per §17 | **Small** | — | No |
| **R-20** | Welding content has had no qualified professional review | **Medium** | Welding track | Plausible-sounding but unreviewed trade language | Credibility with employers and partners | — | Establish a named reviewer and a content governance record | **Small** | External reviewer | Yes |

---

## 23. Quick Wins

Each is Small effort, independently shippable, and carries no dependency on the
mission redesign.

| # | Change | File | Value |
|---|---|---|---|
| 1 | Add Home as the first bottom-nav item | `index.html` nav block | The Version 2 primary screen becomes reachable on mobile |
| 2 | Re-render `rateHTML()` and `homeDueCard()` on Home | `rHome` | Restores the Play rating prompt and the spaced-repetition nudge |
| 3 | Add the 7 missing engine scripts to `sw.js` `SHELL` | `sw.js` | Restores offline-first for the career layer |
| 4 | Delete `ConversationOrchestrator.feedback()` and its stored output | `conversation-orchestrator.js`, `index.html:7182` | Removes fabricated data from synced state |
| 5 | Remove the QA/QC and Blueprint Reading bars from the Passport | `tracks/welding/progress.json` (`passport:false`) | Removes two permanent 0% claims — one JSON edit |
| 6 | Delete `prediction().estimate` from all three render sites | `adaptive-learning-engine.js`, `career-center.js`, `rHome` | Removes an invented forecast |
| 7 | Apply `RP_MAX` regardless of track | `rpListen` | Caps unbounded recording |
| 8 | Add `aria-live="polite"` to `#simStatus` / `#rpStatus`; dynamic mic `aria-label` + `aria-pressed` | `index.html` | Makes the voice UI usable with a screen reader |
| 9 | Add correct i18n keys for the Welding Thu/Sat session links | `tracks/welding/weeks.json` + `I18N_EN` | Button labels match destinations |
| 10 | Require objective coverage before honouring `data.complete` | `conversation-orchestrator.js` | Closes the completion-injection path |
| 11 | Word-boundary objective matching | `professional-simulation-engine.js` `objectives()` | Fewer false objective completions |
| 12 | Rename `simulation-blue-mode` → `track-accent-mode` | `index.html` CSS + `go()` | Removes a maintenance trap |
| 13 | Rewrite the simulation opening line: drop the scenario title, use the in-scene question | `professional-simulation-engine.js` `start()` | Immediately reduces the questionnaire feel |
| 14 | Update `privacy.html` for simulation transcripts and the resume field | `privacy.html` | Closes the largest disclosure gap |
| 15 | Delete `docs/architecture/02–15` and the duplicate decision log; fix the Sprint 10 changelog claim | `docs/` | Documentation stops misleading future work |
| 16 | Remove the coach modal; render the summary inline on return | `learning-coach.js`, `awardCompetency` | Removes the most intrusive interruption in the app |

---

## 24. Version 2 Prioritised Roadmap

Sequenced so that each phase makes the next one cheaper. Content authoring runs in
parallel throughout because it is the long pole and it does not block code.

### Phase 0a — Privacy and disclosure (Small–Medium) ← **do first**

R-04. Allow-list the sync payload; delete `voiceFeedback`; bound `simulations.live`
retention and add a deletion control; rewrite `privacy.html` §2/§4/§5; purge
transcripts already in Firestore; re-check the Play Data Safety form.

*Acceptance:* a signed-in learner's Firestore document contains no transcript,
no extracted fact and no résumé text; every sentence in §4 and §5 of the policy is
true of the shipped code.

*Why first:* it is live, it is a disclosure defect rather than a design debt, and
it depends on nothing else in this roadmap.

### Phase 0b — Endpoint hardening (Medium)

R-03. Server-side `promptId` templates; bearer credential; global rate limiting;
production allow-list without `localhost`.

*Acceptance:* a `curl` request carrying a forged `Origin` and an arbitrary system
prompt is rejected; the four in-app AI features are unaffected.

### Phase 0c — Integrity and reachability (1 sprint, Small–Medium)

Quick Wins 1–16. Outcome: no fabricated metric is displayed or stored, the career
layer works offline, the voice UI is operable with assistive technology, the store
rating prompt is back, and the documentation stops contradicting the code.

*Acceptance:* zero rendered metrics without a traceable source; `sw.js` precaches
all engine scripts; screen-reader turn announcement verified; `git grep` finds no
`voiceFeedback`.

### Phase 1 — The mission workspace (1–2 sprints, Large) ← **recommended next**

Detailed in §25.

### Phase 2 — The evidence ledger (1–2 sprints, Large)

Four-level evidence model; `CompetencyEngine` records evidence level; competency
percentages replaced with evidence statements; readiness reduced to one honest,
explainable line or removed; milestones become named evidence sets; "Career Ready"
renamed; Passport, Progress and Profile rebuilt around the ledger; `S` schema
version and migration added first.

*Acceptance:* the §13.2 worked example produces zero performance claims;
every learner-facing statement can be traced to an artefact.

### Phase 3 — One voice engine and pack-driven dialogue (1–2 sprints, Medium)

Extract `voice.js` on `MediaRecorder` + Whisper; both surfaces use it; fallback
dialogue moves into track packs; Welding-specific regexes leave the engine;
per-character stance added; two to three unexpected events per scenario;
transcript-grounded debrief.

*Acceptance:* an offline "Safety Stop-Work" run never says "welcome aboard"; a
non-Welding pack produces no welding language; audio evidence exists for every
spoken turn on both surfaces.

### Phase 4 — Coach and content depth (2 sprints, Medium + Large)

Four-sentence transcript-grounded coach in one location. Welding content authored
to depth (target: 150 terms, 60 phrases, 8–10 shadow clips, distinct objectives per
scenario) and reviewed by a qualified welding professional, with the review
recorded.

*Acceptance:* the coach quotes the learner; a named reviewer has signed off the
Welding pack.

### Phase 5 — Privacy, security and evaluation hardening (1 sprint, Medium)

Server-side prompt ids; origin-bound token or Turnstile on the chat path;
transcript retention and deletion; `privacy.html` rewrite; a minimal prompt
evaluation set (empty, one-word, off-topic, adversarial, non-native syntax,
injection) run against both conversation prompts; `node:test` harness.

*Acceptance:* the chat endpoint rejects an arbitrary system prompt; the evaluation
set passes; tests run in CI.

### Phase 6 — International and track expansion (deferred)

Onboarding profession step; destination packs that change behaviour rather than
prose; the third track only after Phases 1–5 and only with reviewed content. User
research in Cameroon and Nigeria before, not after.

**Explicitly deferred:** employer dashboards, verified credentials, labour-market
claims, more professions, more destinations, any new AI feature.

---

## 25. Recommended Next Sprint

**One sprint. One outcome. Nothing else.**

### Sprint: Make "Continue Today's Mission" true

**Problem.** Home promises a workplace mission with a reason. The button lands on
an unchanged 25-minute worksheet with no mission, no workplace, no character and no
way back. This is the exact gap between the product Vision 2 describes and the
product that exists, and every other Version 2 improvement is diminished by it.

**Affected users.** Every learner on every track, on their most frequent journey.

**Outcome.** A learner taps one button on Home, understands the workplace moment
they are preparing for, completes two to three connected steps including one
spoken moment, sees what they produced, and is returned to Home with the next
mission visible.

**Scope — in**

1. **Mission schema in track data** (`tracks/*/weeks.json`): each day resolves to a
   mission with `title`, `workplace`, `why`, `steps[]` (each `{kind, ref}` where
   `kind ∈ shadow | phrases | vocab | conversation | record}`), and `evidence`
   (what completing it produces). General English days map to their existing
   content — no curriculum rewrite.
2. **`mission.js`**: `current()`, `resolve(day)`, `renderBriefing()`,
   `openStep(i)`, `returnToMission()`, `complete()`.
3. **Mission briefing screen**: generalise `simMissionBriefing` — it already works;
   make it read every field from data instead of hardcoding "12 minutes / Beginner
   / First day", and make it the entry to every mission, not just `welding-sim-1`.
4. **Step sequencing and return paths**: opening Shadow, Phrase Lab, Vocabulary or a
   conversation from a mission shows a persistent mission bar and returns to the
   mission on completion. Extend the existing `SESS_RETURN` mechanism rather than
   inventing a second one.
5. **Session becomes the mission workspace**: mission header at the top; timer,
   checklist, script, posture, notes and self-score demoted or disclosed; "mark
   complete" becomes "finish this mission" and shows what evidence was produced.
6. **Every string through `t()`**, including the Home dashboard strings added in
   Experience Layer 1, with the 15 packs updated.
7. **Home as the first bottom-nav item** (Quick Win 1 — required for the return path).

**Scope — out**

- The evidence ledger rework (Phase 2) — but **do not add any new score** in this
  sprint.
- Voice engine consolidation (Phase 3).
- Coach rewrite (Phase 4).
- Content authoring (parallel track).
- Any new profession, destination or AI feature.

**Acceptance criteria**

1. Tapping "Continue Today's Mission" opens a briefing that names the workplace
   moment, why it matters, and the steps.
2. Every step opened from a mission returns to that mission.
3. A Welding mission and a General English day use the same code path, the same
   screens, and different data only.
4. No existing General English day, session, recording, note, score or progress
   value is lost. Verified against a pre-sprint `localStorage` export.
5. Finishing a mission returns the learner to Home with the next mission shown.
6. No new metric, percentage, competency award or readiness change is introduced.
7. All new strings have i18n keys; key parity holds at 15 files.
8. Screen-reader: the mission header is announced on step return; heading order is
   valid on every new screen.
9. `node --check` clean, JSON valid, local verification recorded.

**Dependencies.** Quick Wins 1, 2, 3 and 9 should land first (they are hours, not
days, and two of them are prerequisites for the return path).

**Effort.** Large — one to two sprints.

**Research.** Yes, and it is cheap: before building, show five target users
(ideally welders in Cameroon or Nigeria) the existing mission briefing screen and
the current session screen and ask which one tells them what to do. After
building, watch five learners complete one mission unaided. That is the only
evidence that will tell you whether the mission framing works, and no amount of
internal review substitutes for it.

---

## Appendix A — Issue index by severity

**Critical (7):** **R-03 caller-programmable AI endpoint** · **R-04 transcript and
résumé sync without accurate disclosure** (incl. P11 inaccurate policy claims and
P12 undisclosed Google ASR) · R-01 participation as competence · R-02 English-only
Version 2 · R-05 voice UI inaccessible · R-06 Home CTA contradicted · plus the
Welding-hardcoded engine (R-07) once a second track is committed to.

**High (9):** R-07 · R-08 offline gap · R-09 two voice engines · R-10 completion
injection · R-11 content depth · R-12 rating prompt lost · R-13 uncapped recording ·
R-14 no tests · P2 per-isolate rate limits and shared-NAT throttling.

**Medium (7):** R-15 mislabelled links · R-16 no migration · R-17 substring
matching · R-18 onboarding · R-19 documentation drift · R-20 unreviewed trade
content · P5 transcript retention.

**Low (4):** `simulation-blue-mode` naming · nav label inconsistency between
desktop and mobile · A17 session-wrapper skips shared router work · A18 dead
`_views` constant.

## Appendix B — Verification performed

- `node --check` on all nine JavaScript modules and `sw.js`: clean.
- `new Function` over the four non-JSON-LD inline `<script>` blocks: 4 scripts, 0 errors.
- `json.load` on all twelve track pack files: valid.
- i18n key parity: `I18N_EN` = 1,184 keys; `i18n/fr.json` = 1,184; 0 missing, 0 orphaned.
- Reachability of `homePanelDashboard`, `homeWeekStrip`, `homeDueCard`, `homePanelRules`, `rateHTML`, `_views`: confirmed unreferenced.
- `t()` call count in the seven Version 2 modules: 0.
- `aria-live` occurrences in `index.html`: 1 (`aria-live="off"`).
- `sw.js` `SHELL`: 2 of 9 engine scripts present.
- `POLISH_API` (`index.html:7659`): live Worker URL, not a placeholder.
- Worker origin gate: explicit `403` on unlisted `Origin`; `ALLOWED_ORIGINS` includes `localhost:8000` and `127.0.0.1:8000`.
- `fbPush` payload: `JSON.stringify(S)`, no key allow-list — confirmed at three call sites.
- `privacy.html` §4/§5: exhaustive-claim wording confirmed verbatim; simulation chat and résumé field absent from both lists.
- No-speech worked example (§13.2): recomputed programmatically from `tracks/welding/progress.json` — readiness 13%, two achievements.
- `go('session')`: wrapper at `index.html:8686` verified; the CTA does not throw.
- `git diff --check`: clean.

## Appendix C — Corrections log (revision 1 → revision 2)

Four claims in revision 1 were overstated. All are corrected above. No structural
finding was withdrawn, and each correction makes the specific claim less dramatic
while leaving the underlying issue intact.

| # | Revision 1 | Verified | Where corrected |
|---|---|---|---|
| C-1 | `safety-beginner` unlocks on **one** Phrase Lab self-mark | **Three** — `phrase_lab` awards `safety: 1` and score equals the point count | §5.25, §11.2 |
| C-2 | The no-speech example unlocks **three** achievements incl. *Vocabulary Starter* | **Two** — Workshop Ready and Safety Beginner; `vocabulary-starter` requires `vocabulary_practice`, a different activity type | §13.2 |
| C-3 | Career readiness in that example ≈ **14%** | **13%**, recomputed from the real weights | §13.2 |
| C-4 | `interview-beginner` unlocks on **less than one** conversation | **Exactly one** — `ai_conversation` awards `interview: 3` against a threshold of 3 | §5.25 |

Two findings were **strengthened** on re-inspection: P1 now credits the Worker's
explicit server-side `403` origin gate while showing why a forgeable header is not
authentication; P3/P4 are joined by P11 and P12, which establish that the privacy
policy does not merely omit the new data flows but makes three exhaustive claims
that contradict them.

Four findings were **added**: P11, P12, A17, A18.

*Audit produced 2026-08-06, revised the same day. No application code,
configuration or content was modified. Nothing was committed, pushed or deployed.*
