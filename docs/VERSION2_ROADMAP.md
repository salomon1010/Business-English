# Version 2 Engineering Roadmap

## Implementation Status

**Experience Layer 1 — Career Dashboard: complete.** Home now resolves the active track, destination, workplace context, milestone, mission, and coach recommendation into one primary continuation action. The remaining Quick Wins and Sprint 1 work should build the mission sequence and its contextual return paths without reintroducing competing Home actions.

## Optimal Sequence

Make the existing journey coherent before adding tracks, regions, or new AI systems. The first deliverable is a mission shell that orchestrates current engines and makes evidence truthful. Subsequent work deepens content contracts, coaching quality, and international readiness.

| Workstream | Scope | Risk | Complexity | Dependencies | Business value | Learning value | Career impact |
|---|---|---:|---:|---|---:|---:|---:|
| Quick Wins | Terminology, current-mission visibility, return paths, empty-evidence copy | Low | Low | Existing routing/UI | High | High | High |
| Sprint 1 | Mission data contract and Home/Journey/Mission shell | Medium | Medium | Curriculum Provider, track context | High | High | High |
| Sprint 2 | Mission-linked Shadow, Phrase Lab, Vocabulary, Practice, and simulations | Medium | Medium | Mission contract, existing content packs | High | High | High |
| Sprint 3 | Evidence model, debrief integrity, achievement rules, Progress/Passport redesign | High | Medium | Activity log, competency engine, coach | High | High | High |
| Sprint 4 | Human coach memory contract, prompt contracts, evaluation harness | High | High | Evidence model, AI gateway, privacy review | High | High | High |
| Sprint 5 | Destination-pack contract and reviewed Cameroon/Nigeria pilot | High | High | Stable mission/coach contract, local review | Medium | Medium | High |

## Quick Wins

- Rename learner-facing “lesson” and “activity” language to mission language where it does not alter General English content.
- Make active track, current mission, and one next action persistent on Home and all direct-entry learning surfaces.
- Add contextual “Back to mission” and “Choose another interviewer” paths.
- Remove or demote duplicate recommendation cards.
- Make no-evidence, interrupted, and offline states explicit and non-judgmental.

## Sprint 1 — Career Journey Shell

**Outcome:** Home, Journey, and a new mission workspace present one coherent next step while reading existing track data.

**Deliverables:** mission schema/version strategy; current-mission resolver; track-aware Home and Journey; mission briefing; routing and persistence design; General English compatibility tests.

**Acceptance:** returning learners resume the correct track and mission; no existing General English day/session is lost; no new scoring occurs.

## Sprint 2 — Mission-Linked Learning

**Outcome:** every learning surface can be opened as a step in an active mission and returns to that mission.

**Deliverables:** step sequencing; filtered target vocabulary/phrases/shadow; character selection inside mission scenarios; focused independent-practice escape hatch; content-pack validation.

**Acceptance:** a Welding mission and a General English session use the same shared pathway without duplicate pages or curriculum forks.

## Sprint 3 — Honest Evidence and Professional Milestones

**Outcome:** learner progress distinguishes completion, production, demonstration, and growth.

**Deliverables:** auditable evidence events; objective-to-evidence rules; debrief contract; achievement and milestone logic; Progress/Passport evidence views; migration and local-state compatibility plan.

**Acceptance:** no empty interaction produces a score, competency award, achievement, readiness change, or performance claim.

## Sprint 4 — Personal AI Coach Quality

**Outcome:** coaching feels personal because it is grounded, concise, and consistent across time.

**Deliverables:** character and coach prompt contracts; bounded memory model; structured output validation; adversarial/empty-input evaluation set; daily/weekly/monthly/career/interview coaching templates; privacy review.

**Acceptance:** every coach statement is traceable to allowed data, uncertainty is visible, and automated/manual evaluation catches fabricated claims.

## Sprint 5 — International Pilot Architecture

**Outcome:** destination adaptation is a governed configuration layer, not a fork.

**Deliverables:** destination pack schema; selected-destination ownership and consent; reviewed Cameroon/Nigeria communication variants; Career Center integration; content review workflow; market-research plan.

**Acceptance:** no destination pack creates legal/licensing/immigration claims, and all regional content has versioned human review.

## Cross-Cutting Controls

- Keep AI secrets server-side; preserve local-first storage and explicit sync consent.
- Treat curriculum, character, prompt, and destination packs as versioned, validated data.
- Add tests before refactoring the monolithic SPA path: routing, state persistence, track switching, empty evidence, and no-regression General English flows.
- Run locally and verify browser console, touch/keyboard/accessibility states, and data migration before every commit. Do not deploy without explicit approval.

## Deferred Until Evidence Exists

Employer dashboards, verified credentials, labour-market claims, automatic hiring predictions, social ranking, and broad multi-profession expansion are intentionally deferred. They need governance, consent, validated measurement, and demonstrated user value that the current repository does not yet provide.
