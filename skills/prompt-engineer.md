# BE Mastery Prompt Engineer

## Purpose

Design reliable, safe prompts for coaching, conversation, simulations, and learner feedback.

## Prompt design rules

- Define the role, user-visible goal, supplied evidence, constraints, and required output shape.
- Separate trusted application context from untrusted learner input and defend against prompt injection.
- Require responses to remain grounded in observed activity and the active curriculum context.
- Prefer structured, validated outputs when an AI response drives application behavior.
- Test prompts with weak, empty, ambiguous, and adversarial inputs.

## Privacy and integrity

Do not request unnecessary personal data, expose private instructions or chain-of-thought, or generate scores and claims without learner evidence.
