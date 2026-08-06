# Changelog

## Sprint 10 — Live AI Workplace Engine

### Added

- Added the reusable, profession-independent Conversation Orchestrator.
- Replaced the Professional Simulation flow with the existing full-screen voice conversation layout, using one active workplace prompt at a time.
- Added character voice profiles, active-speaker state, speaking/listening status, waveform feedback, current objective, and objective progress.
- Added explicit natural-voice assignments for each Welding simulation character, with gender-matched browser voices as the offline fallback.
- Added persisted in-progress simulation sessions, voice session metadata, conversation history, and response-derived live-feedback signals.
- Added contextual AI follow-up turns through the existing secured conversation service, with the established local scenario behavior as a safe fallback.

### Changed

- Professional Simulation now requires spoken input; text areas, send controls, and scrolling conversation history have been removed.
- Simulation debrief language now presents coaching-oriented workplace feedback.
- Welding Practice now uses the established card-based role-play library as **Professional Interview Coaches**. Each existing technical topic is presented as a named professional interview with its assigned coach; the Workshop Simulation entry is no longer shown in the Welding learner path.

### Compatibility

- Existing Professional Track curriculum, competency awards, Skills Passport, AI Coach, Adaptive Learning, Career Center, and Professional Journey integrations are retained.
- Browser speech recognition and synthesis are required for the live voice experience; no new backend or deployment was added.

## Sprint 9 — Global Career Readiness Center

### Added

- Added a track-aware Career Center dashboard accessible from Profile.
- Added persistent destination selection for Cameroon, Nigeria, South Africa, Canada, the United States, and International Contractor contexts.
- Added destination-specific interview, workplace communication, culture, and certification-preparation guidance.
- Added a Career Gap Analysis backed by the existing Adaptive Learning Engine.
- Added a Resume & LinkedIn Coach that uses the existing polishing service when available and provides local guidance otherwise.
- Added Mock Interview Pack links to the active track's existing AI mentor and Professional Simulation.

### Compatibility

- The Career Center reuses existing Professional Track, Competency, AI Coach, Career Readiness, and Simulation systems; no duplicate learning engine was added.
- Certification guidance is educational only and directs learners to verify current official and employer requirements.
- General English and Welding remain available and unchanged outside the new Profile entry point.
- No deployment was performed.

## Sprint 8 — Complete Welding Professional Track Curriculum

### Added

- Expanded Welding into 12 progressive professional stages, from Entering the Workshop to Career Ready.
- Added stage-specific objectives, daily missions, Phrase Lab content, vocabulary, AI mentors, simulations, and competency focus.
- Added four welding progression phases: Workshop Foundations, Technical Communication, Workplace Standards, and Career Readiness.
- Added 12 Welding AI mentors and 12 Professional Simulations.

### Changed

- Welding now presents a Professional Journey with stage labels; General English retains its existing Week-based journey.

### Compatibility

- Existing professional engines continue to use the active Welding track pack without architectural changes.
- No deployment was performed.

## Sprint 7 — Adaptive Learning Intelligence

### Added

- Added a local Adaptive Learning Engine that ranks the single best next activity.
- Added the Career Readiness Roadmap, professional milestones, missing-skill analysis, and estimated next-milestone time.
- Added a Professional Activity Calendar and Weekly Growth Dashboard.
- Added explainable Career Readiness and Interview Readiness predictions based on existing learner evidence.

### Compatibility

- The existing curriculum, Practice, AI Coach, simulation, and General English experiences remain intact.
- Adaptive recommendations use existing local learner data only; no new external service or deployment was added.

## Sprint 6 — Professional Simulation Engine

### Added

- Added the reusable Professional Simulation Engine and track-pack simulation schema.
- Added Professional Simulation as a second Practice option; existing AI Practice remains unchanged.
- Added the Welding simulation: First Day at a Welding Workshop.
- Added adaptive multi-character responses, an unexpected workplace event, persistent simulation history, competency awards, and a six-area debrief.

### Compatibility

- General English continues to show its existing Practice and AI conversation experiences.
- No Week 2 or other curriculum content was added.
- No deployment was performed.

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
