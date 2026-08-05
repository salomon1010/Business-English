# Changelog

## Sprint 5 — AI Learning Coach

### Added

- Added personalized coaching summaries after every competency-awarding activity.
- Added daily missions and smart Home recommendations based on the active track and competency history.
- Added an automatic Weekly AI Review and a Professional Growth Story.
- Added persistent coach summaries and track-scoped coaching memory using the existing storage strategy.

### Compatibility

- General English and Welding both use the same coaching engine and retain their existing curriculum and UI flows.
- Coaching is generated locally from existing learner evidence; no new external service or deployment was added.

## Sprint 4 — Professional Skills Passport & Competency Engine

### Added

- Added the reusable Professional Skills Passport to Profile.
- Added Professional Growth to Progress, including Career Readiness, competency progress, recent achievements, and weekly growth.
- Added a persistent activity log with date, activity type, track, lesson, competency awards, score, and duration.
- Added a configuration-driven Competency Engine and achievement framework.

### Changed

- Curriculum progress packs now own competency definitions, activity mappings, readiness weights, and achievement rules.
- Professional-track session completion is now stored independently from General English session completion.

### Compatibility

- General English displays Communication, Professional Vocabulary, Pronunciation, Confidence, and Professionalism only.
- Welding displays its additional career readiness competencies without changing the General English curriculum.
- No deployment was performed.

## Sprint 3 — Welding Week 1

### Added

- Added the first Professional Track curriculum: Welding, Week 1 — Professional Introduction to Welding.
- Added seven guided daily sessions, a weekly mission, professional introduction phrases, and a Week 1 vocabulary set.
- Added three curated shadowing starters focused on confident professional delivery.
- Added the HR Recruiter AI mentor scenario for a non-technical professional introduction conversation.

### Changed

- Extended the curriculum provider so Professional Track packs can supply AI mentors and role-play categories.
- Made the role-play library read the active track's AI mentor scenarios while preserving the General English scenario library.
- Added an in-context curriculum vocabulary card to the existing Vocabulary library when a track supplies starter vocabulary.

### Compatibility

- General English content, UI, and existing role-play featured scenario remain unchanged.
- No deployment was performed.
