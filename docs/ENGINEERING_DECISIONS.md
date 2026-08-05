# Engineering Decisions

## Sprint 3 — Welding Week 1

| Decision ID | Date | Related Lecture | Problem | Options Considered | Decision | Rationale | Trade-offs | Status |
|---|---|---|---|---|---|---|---|---|
| ED-003 | 2026-08-05 | Generative AI | Provide a first AI mentor without creating a separate Welding application or changing General English content. | Add a separate mentor screen; add a Welding-only scenario to the existing role-play engine; defer AI mentor support. | Allow curriculum packs to provide AI mentor scenarios and role-play categories; Welding supplies one HR Recruiter scenario. | Reuses the existing conversation engine and makes mentor content track-specific. | The role-play UI remains shared, so track-specific visual branding is deferred. | Accepted |
| ED-004 | 2026-08-05 | Building AI Apps | Give Welding learners Week 1 vocabulary without pre-populating or overwriting personal vocabulary. | Automatically seed learner vocabulary; show curriculum vocabulary as reference; omit a vocabulary list. | Display track-provided vocabulary as optional saveable words in the existing Vocabulary library. | Learners receive immediate vocabulary guidance while retaining control over their personal study list. | Definitions are concise reference descriptions; full dictionary detail remains on-demand. | Accepted |
