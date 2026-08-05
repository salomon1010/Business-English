# Engineering Decisions

## Sprint 3 — Welding Week 1

| Decision ID | Date | Related Lecture | Problem | Options Considered | Decision | Rationale | Trade-offs | Status |
|---|---|---|---|---|---|---|---|---|
| ED-003 | 2026-08-05 | Generative AI | Provide a first AI mentor without creating a separate Welding application or changing General English content. | Add a separate mentor screen; add a Welding-only scenario to the existing role-play engine; defer AI mentor support. | Allow curriculum packs to provide AI mentor scenarios and role-play categories; Welding supplies one HR Recruiter scenario. | Reuses the existing conversation engine and makes mentor content track-specific. | The role-play UI remains shared, so track-specific visual branding is deferred. | Accepted |
| ED-004 | 2026-08-05 | Building AI Apps | Give Welding learners Week 1 vocabulary without pre-populating or overwriting personal vocabulary. | Automatically seed learner vocabulary; show curriculum vocabulary as reference; omit a vocabulary list. | Display track-provided vocabulary as optional saveable words in the existing Vocabulary library. | Learners receive immediate vocabulary guidance while retaining control over their personal study list. | Definitions are concise reference descriptions; full dictionary detail remains on-demand. | Accepted |

## Sprint 4 — Professional Skills Passport & Competency Engine

| Decision ID | Date | Related Lecture | Problem | Options Considered | Decision | Rationale | Trade-offs | Status |
|---|---|---|---|---|---|---|---|---|
| ED-005 | 2026-08-05 | Evaluation | Make varied learning activities contribute to measurable professional outcomes. | Add counters in individual pages; create a central hard-coded scoring service; use a configuration-driven competency engine. | Use a local Competency Engine that applies mappings defined by each curriculum pack. | New tracks can define different professional outcomes without duplicating UI or scoring logic. | Scores are intentionally lightweight and local-first; calibration against real employment outcomes is deferred. | Accepted |
| ED-006 | 2026-08-05 | Monitoring | Retain an auditable record of how a learner earned competency progress. | Store aggregate totals only; store full activity logs; send logs to a new backend. | Persist a bounded local activity history and derive totals, readiness, and achievements from it. | Supports later analytics and coaching while retaining the existing privacy-first storage model. | Cross-device synchronization is best-effort through existing state sync; no dedicated event backend was added. | Accepted |
| ED-007 | 2026-08-05 | Scaling | Prevent track switching from conflating professional-track completion with the existing General English journey. | Share all session keys; migrate all historical keys; namespace professional-track keys while preserving General English keys. | Namespace non-General-English session keys and retain legacy General English keys. | Keeps existing learner progress compatible and isolates future tracks. | Historical Welding test/foundation progress is not migrated automatically. | Accepted |
