# BE Mastery Vision 2

> Status: Product constitution. This document is the single source of truth for future product decisions and implementation. Where it conflicts with older product-positioning, roadmap, or design guidance, this document takes precedence. It does not override security, privacy, legal, or deployment safeguards.

## Product Mission

BE Mastery helps skilled professionals build the workplace communication evidence, confidence, and professional identity needed to pursue career opportunities in English-speaking environments.

English is the vehicle. Career progress is the destination.

## Product Vision

BE Mastery will become an AI Career Readiness Platform for skilled professionals preparing to enter, contribute to, and grow in real workplaces. It is not a generic English course, a vocabulary game, or an interview simulator.

When a learner opens the product, the intended feeling is:

> “I am preparing for my future career.”

The product’s first promise is not employment, certification, immigration eligibility, or technical qualification. Its credible promise is stronger workplace communication practice and transparent evidence of that practice.

## Product Philosophy

- Start with a real professional situation, not a language topic.
- Build professional identity through repeated, purposeful communication.
- Prefer one meaningful next action over a large menu of features.
- Treat adults as capable practitioners. Be concise, respectful, and practical.
- Protect trust: do not invent performance, progress, career readiness, or workplace competence.
- Keep General English intact. It is the foundation track within the same learning engine, not a separate product.

## Target Users

### Primary users

Skilled workers and technical professionals in Cameroon, Nigeria, Ghana, Kenya, South Africa, Francophone Africa, and English-speaking Africa who need stronger English communication for work and career mobility.

Current and future professions include Welders, Electricians, HVAC Technicians, Construction Workers, Industrial Technicians, Mechanics, Healthcare Professionals, Manufacturing Workers, Customer Service professionals, and Engineers.

### Secondary users

Professionals preparing for work opportunities in Canada, the United States, the United Kingdom, Australia, the Middle East, and international contracting environments.

### Core job to be done

“Help me communicate my experience, work safely with others, and present myself confidently in professional English so I can pursue better career opportunities.”

## Career Readiness Philosophy

Career readiness is a formative, evidence-based view of a learner’s communication preparedness. It is not a hiring prediction, licence, trade qualification, employer endorsement, or immigration assessment.

Every career-readiness statement must answer at least one of these questions:

- What communication evidence has the learner built?
- Which workplace situation can they now practise more confidently?
- What is the next missing communication capability?
- How does the next activity support workplace success or career preparation?

Use language such as “communication readiness evidence,” “practice completed,” and “next growth opportunity.” Do not imply that a learner is employable, certified, or safe to perform technical work solely from app activity.

## Definition of Career Evidence

Career evidence is learner activity that can be honestly connected to a professional communication outcome.

| Evidence level | Meaning | Example |
|---|---|---|
| Participation | The learner completed a meaningful activity. | Finished a guided mission or saved a relevant word. |
| Production | The learner produced a recorded or transcribed response. | Gave a spoken professional introduction. |
| Demonstration | The learner addressed a stated workplace objective with observable language. | Explained relevant experience or used a safety escalation phrase in context. |
| Growth | The learner shows improvement across comparable, retained evidence. | A clearer repeat introduction or stronger coverage of a recurring objective. |

No speech, recording, transcript, or other usable evidence means no performance score, competency award, or claim of improvement. Self-reported completion remains useful, but must be labelled as completion rather than demonstrated ability.

## Learning Philosophy

BE Mastery teaches through a professional journey:

```text
Professional identity → workplace mission → guided practice → spoken evidence
→ honest debrief → next milestone
```

- Replace lessons with missions.
- Replace exercises with workplace situations.
- Replace modules and weeks with stages and professional milestones for Professional Tracks.
- Keep a structured progression: understand → practise with support → produce independently → reflect → repeat in context.
- Make Shadow, Phrase Lab, Vocabulary, mentor conversations, and simulations serve the learner’s current mission.
- Preserve learner control: learners choose when to save vocabulary, repeat a scenario, or continue a conversation.

The current General English twelve-week programme remains supported. Professional Tracks use the same shared engine while adapting curriculum, language, workplace context, competencies, and visual identity.

## AI Philosophy

AI is a coach and workplace partner, not the product’s main character.

- AI should respond to the learner’s actual words and relevant prior context.
- Characters have a clear role, communication style, and reason for appearing.
- Coaching should celebrate demonstrated effort, identify one useful growth area, and recommend one next action.
- AI outputs that affect state or scoring must be bounded, validated, and grounded in supplied evidence.
- Never expose private instructions, chain-of-thought, or unnecessary learner data.
- Natural voice is preferred where online service is available; appropriate browser voices are the continuity fallback.
- Local, deterministic behaviour remains the safe fallback when online AI is unavailable.

The product must be transparent when evidence is insufficient. It must never compensate for missing evidence with fabricated grammar, confidence, competency, or readiness scores.

## UX Philosophy

Every screen answers one primary learner question, supports one primary action, and creates one emotional outcome.

| Surface | Primary question |
|---|---|
| Home | What is my next professional step? |
| Journey | Where am I in my professional progression? |
| Mission / Session | What must I practise now? |
| Shadow | What language will help me in this mission? |
| Phrase Lab | What can I say at work today? |
| Vocabulary | What language should I retain and use? |
| Simulation | How do I handle this workplace situation? |
| Progress | What professional growth have I earned? |
| Profile | Who am I becoming professionally? |
| Career Center | How do I prepare for my intended destination? |

Reduce explanatory text in favour of hierarchy, meaningful labels, compact evidence, and progressive disclosure. Preserve the existing accessibility baseline: readable contrast, 44px touch targets, keyboard operation, reduced-motion support, localization, and RTL behaviour.

## Design Principles

- One primary action per viewport.
- Use existing shared components before creating new ones.
- Preserve the blue-violet General English identity.
- Give each professional track a distinct, accessible theme; Welding uses amber-on-charcoal.
- Use colour to clarify track identity, activity state, achievement, warning, and destructive action—never as the only source of meaning.
- Use professional, calm language. No childish rewards, mascots, pressure, or hype.
- Motion must confirm an action or communicate live voice state; it must not decorate.
- Track identity, current mission, and next step must be visible to a returning learner.

## Gamification Philosophy

Motivation comes from visible professional growth, not compulsive engagement.

- Achievements represent meaningful career moments: first professional introduction, safety briefing, supervisor conversation, quality report, interview story, or career story.
- Streaks are a personal training log, never a penalty mechanism.
- Milestones replace generic completion labels when professional context is available.
- Rewards must be tied to completed or demonstrated evidence.
- No public leaderboards, meaningless badge volume, fabricated scores, coercive reminders, or dark patterns.

## Professional Track Strategy

One platform. One learner state. One learning engine. Many curriculum packs.

Each Professional Track must provide, through configuration rather than duplicated application logic:

- track identity, theme, availability, and curriculum source;
- stages, daily activities, and mission outcomes;
- shadow, phrase, vocabulary, mentor, and simulation content;
- professional competencies, activity mappings, readiness weights, and achievement rules;
- workplace characters, objectives, unexpected events, and debrief guidance.

The current tracks are General English and Welding. Future tracks must meet the same content, evidence, safety, accessibility, and validation standards before becoming available. A new profession must not create a separate application or a forked learning engine.

## International Strategy

BE Mastery is designed for local career confidence and international mobility.

### Cameroon, Nigeria, and Africa

Prioritize practical workplace English, professional confidence, clear safety communication, teamwork, supervisor updates, and the ability to explain real experience without overstating qualifications. Support multilingual entry points while keeping English production practice central.

### Canada and the United States

Prepare learners for clear, concise, collaborative workplace communication; structured experience examples; respectful clarification; safety and quality communication; and professional interview storytelling.

### International guidance boundary

The Career Center may provide educational destination guidance, workplace-culture preparation, and prompts to verify requirements. It must not provide legal, immigration, licensing, certification-recognition, wage, or job-eligibility advice as authoritative.

## Architecture Principles

- Curriculum, simulation definitions, prompts, and track configuration are data; shared product behaviour is engine code.
- Maintain local-first ownership: learner state in browser storage and recordings on device by default.
- Optional cloud sync must not become a prerequisite for learning.
- Keep AI keys server-side and separate AI, analytics, and push workloads.
- Reuse the Curriculum Provider, Professional Track Context, Competency Engine, Learning Coach, Adaptive Learning Engine, Professional Simulation Engine, Skills Passport, and Career Center.
- Version and validate track packs and AI response contracts before expanding to new professions.
- Keep activity logs auditable and bounded. Derive totals, achievements, and readiness from those logs.
- Preserve General English compatibility whenever track-aware behaviour changes.
- Validate locally before every commit; never deploy or push without explicit approval.

## Expansion Strategy

Expansion is earned through repeatable quality, not by adding professions quickly.

1. Make the current General English and Welding journeys coherent around missions and evidence.
2. Standardize the professional-track content contract and validation process.
3. Validate learner comprehension, engagement, and career relevance with real users in target markets.
4. Add the next profession only when its curriculum, vocabulary, simulations, safety boundaries, and destination relevance have qualified review.
5. Introduce enterprise, employer, credential, or labour-market integrations only after data governance, consent, evaluation, and operational ownership are defined.

## Product Roadmap

### Phase 1 — Coherent Career Journey

Align Home, Journey, Session, Progress, and Profile around the current mission, evidence captured, and next milestone. Simplify dense surfaces before adding features.

### Phase 2 — Mission-Linked Learning

Make Shadow, Phrase Lab, Vocabulary, mentor conversations, and simulations dynamically serve the active mission. Extend the reusable mission pattern beyond Welding Stage 1 through track data.

### Phase 3 — Evidence Quality and Coaching

Differentiate completion from production and demonstrated communication. Strengthen transcript-grounded feedback, AI-output validation, and evidence-based growth narratives.

### Phase 4 — Track Scale and International Readiness

Add qualified professional tracks through the shared contract. Deepen destination guidance using reviewed, educational content and user research—not unsupported employment claims.

### Phase 5 — Product Governance and Enterprise Readiness

Establish track-pack review, prompt evaluation, model-quality evaluation, privacy review, analytics governance, observability, and repeatable release controls before enterprise expansion.

## Version 2 Objectives

Version 2 is successful when:

- learners perceive BE Mastery as career preparation from their first screen;
- the learner always sees one understandable next professional action;
- every significant activity has a clear connection to workplace communication;
- Career Readiness reflects transparent, evidence-based communication growth;
- AI coaching is personal, concise, useful, and honest about uncertainty;
- professional simulations feel like progressing through a workday, not answering a questionnaire;
- General English remains fully functional and benefits from the shared improvements;
- new professions can plug into the same engine through validated curriculum packs;
- product teams can explain why each feature improves activation, retention, professional confidence, or demonstrated communication evidence.

## Decision Rule for Future Work

Before approving any feature, ask:

1. Which learner problem does this solve?
2. Which career-readiness outcome or evidence does it improve?
3. Why is this the next highest-value action rather than a distraction?
4. Does it preserve one shared learning engine and General English compatibility?
5. Can the product state its result truthfully from available evidence?
6. Does it preserve privacy, accessibility, local-first resilience, and explicit deployment approval?

If those questions cannot be answered, the feature is not ready to build.

## Operating Standard

Every future sprint must begin with a written problem, intended outcome, scope boundary, acceptance criteria, evidence model, and regression considerations. Every completed sprint must be tested locally, committed only after verification, and held for explicit approval before deployment or the next sprint.
