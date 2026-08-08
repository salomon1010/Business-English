# UX Reviewer

An [Agent Skill](https://agentskills.io) that reads your entire codebase and delivers a senior product designer's honest critique of the user experience.

It reads code the way a designer reads a prototype: tracing every path, counting every tap, noticing every dead end. The review it produces is grounded in what the application actually does — not what it looks like from a screenshot.

Compatible with any agent that implements the [agentskills.io](https://agentskills.io) specification: Claude Code, Cursor, Amp, OpenCode, and Codex CLI.

---

## What it does

The skill runs in four phases:

1. **Discovery** — dispatches an agent to read every template, component, route, view, controller, and piece of client-side JavaScript in your project. It comes back with a complete screen inventory, navigation map, and role-by-role breakdown.

2. **Mapping** — traces each user role's primary workflow tap by tap, counting how many screens they cross before reaching productive work.

3. **Analysis** — applies seven structural UX principles: the elimination test, the conveyor belt principle, progressive disclosure, intelligent use of known state, mental model alignment, proportional investment, and surface vs. structure separation.

4. **Review** — writes a structured critique to a markdown file in your project. The chat gets a 3-5 sentence summary. The file is the deliverable.

The review focuses on workflows, not screens. Every recommendation references something specific in the user's journey. No generic UX advice — everything is grounded in what the code reveals.

---

## The review structure

Each review file contains:

- **What Works Well** — specific flows and moments that serve users, with reasons
- **The Core Tension** — the structural issue, if one exists, in two sentences
- **The User's Day** — for each user role, a tap-by-tap narrative of the current experience, the ideal experience, and the gap between them
- **What to Cut** — screens and flows to remove or demote, each with a reason and a replacement
- **What's Missing** — capabilities that don't exist but should, framed as user experiences
- **Priorities** — proposed sequence of improvements ordered by user impact

The review speaks in the language of someone using the app, not someone building it. No file paths, no function names, no code snippets. A designer who has never opened your repo could read it and understand every recommendation.

---

## Frameworks supported

Django · Rails · Laravel · React · Next.js · Vue · Nuxt · Svelte · SvelteKit · Flutter

Any web framework works. The skill detects your stack and uses the appropriate file patterns. See [references/framework-discovery.md](references/framework-discovery.md) for the full pattern list.

---

## Installation

Clone the repo into the skills directory for your agent. Project-level installs (`.agents/`, `.cursor/`, `.opencode/`) are shared with your team when committed. User-level installs are available across all your projects.

**Claude Code**
```bash
git clone https://github.com/swanhtet1992/ux-reviewer ~/.claude/skills/ux-reviewer
```

**Amp**
```bash
# User-wide
git clone https://github.com/swanhtet1992/ux-reviewer ~/.config/agents/skills/ux-reviewer

# Project (commit to share with your team)
git clone https://github.com/swanhtet1992/ux-reviewer .agents/skills/ux-reviewer
```

**Cursor**
```bash
# User-wide
git clone https://github.com/swanhtet1992/ux-reviewer ~/.cursor/skills/ux-reviewer

# Project
git clone https://github.com/swanhtet1992/ux-reviewer .cursor/skills/ux-reviewer
```

**OpenCode**
```bash
# User-wide
git clone https://github.com/swanhtet1992/ux-reviewer ~/.config/opencode/skills/ux-reviewer

# Project
git clone https://github.com/swanhtet1992/ux-reviewer .opencode/skills/ux-reviewer
```

**Codex CLI**
```bash
git clone https://github.com/swanhtet1992/ux-reviewer ~/.codex/skills/ux-reviewer
```

Then reload your agent.

---

## How to trigger it

The agent loads this skill automatically when your request matches. These phrases reliably trigger it:

```
review the UX
audit the user experience
design critique
flow review
screen audit
evaluate app flow
assess usability
give honest UX feedback
improve app navigation
```

If you have a UX plan or design document, share it alongside the request — the skill will evaluate the plan against the actual codebase and note where they diverge.
