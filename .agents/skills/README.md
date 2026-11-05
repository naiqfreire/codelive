# Skills — CodeLive

Skills are reusable instructions the agent loads when a task matches.
They **do not replace** `AGENTS.md`, `SPEC.md`, or the tests. On conflict,
precedence follows `AGENTS.md` (`Source of truth`).

## Main workflow: GSD Core

The team uses GSD Core as the spec-driven development system.
Every phase follows: **discuss → plan → execute → verify → ship**.
The skills below are the entry points of the cycle.

| Skill                 | When to use                                                                                   | What it produces                           |
| --------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `gsd-new-project`     | Project kickoff. Reads `SPEC.md` and generates `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`. | Initial planning                           |
| `gsd-discuss-phase N` | Before planning a phase. Asks questions to remove assumptions.                                | `{phase}-CONTEXT.md` with locked decisions |
| `gsd-plan-phase N`    | Turns the phase into executable, atomic plans.                                                | `PLAN.md` per execution wave               |
| `gsd-execute-phase N` | Executes the phase plans in a clean context.                                                  | Code, tests, and atomic commits            |
| `gsd-verify-work`     | Verifies what was executed before declaring done.                                             | Verification report                        |
| `gsd-ship`            | Prepares verified work for a PR.                                                              | Branch ready for review                    |
| `gsd-quick`           | Small, well-scoped task without the full phase ceremony.                                      | Atomic commit                              |

> **Commits:** GSD proposes atomic commits, but the agent **never runs `git commit`**. The human-review rule and the professor's message format live in `AGENTS.md` (`Commit discipline`).

## Supporting skills

Add here only the skills the team decides to keep. Remove the ones you don't use.

- `grill-me`: When a plan or design decision looks vague, has hidden assumptions, or when two parts of the plan depend on a choice not yet made. Relentless interview, one question at a time, with a recommendation on every question. Can replace or complement the `discuss` phase for critical decisions. See analysis below.
- `ui-ux-pro-max`: when the task involves **UI structure, visual design decisions, interaction patterns, or user experience quality control**: designing new pages, creating/refactoring UI components, choosing color/typography/spacing/layout systems, reviewing UI for UX/accessibility/consistency, implementing navigation/animation/responsive behavior, or improving perceived quality and usability. Skip it for pure backend logic, API/database design, non-visual performance work, infrastructure/DevOps, or non-visual scripts — unless the task changes how something **looks, feels, moves, or is interacted with**.

## Usage rules

1. Before any task, read this README and check whether a skill applies.
2. If no skill matches, follow `AGENTS.md` and `SPEC.md`.
3. If two skills conflict, stop and ask. Do not choose silently.
4. A skill never authorizes skipping authorization tests or committing without human review.

## Maintenance

- This README lists **only** the skills actually installed under `.agents/skills/`.
- When installing or removing a skill, update the list in the same commit.
- Skills outside GSD must state in their own `SKILL.md` that they do not replace the GSD workflow.
