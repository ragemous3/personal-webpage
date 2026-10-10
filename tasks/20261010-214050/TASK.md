# Connect design interviews to the TATR implementation flow

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Connect the project's design interview to a native TATR implementation ticket and a repeatable implementation/review workflow. The requested order is grill-with-docs → tatr-ticket → implement → code-review → blast-radius, with review findings returning to implementation. Preserve the resolved requirements in the ticket and use ADR Tools to create architectural decision records.

## Prerequisites

The existing project tatr-ticket and git-workflow skills are merged into main. Install Matt Pocock's required global skills and dependencies, the linked kishormorol/blast-radius skill, and npryce/adr-tools. This setup changes documentation and tooling only; a feature's public test seams will be agreed during its own grilling stage.

## Acceptance criteria

- [ ] AGENTS.md directs agents to an implementation-flow with the requested stage order and both fix loops.
- [ ] The TATR ticket is the spec passed to implement and code-review, including confirmed test seams and ADR links.
- [ ] Required global skills and their dependencies are installed with supporting files.
- [ ] The adr command is available and ADR creation uses the CLI under docs/adr.
- [ ] The flow pins a review base, reviews committed changes, repeats both reviews after fixes, and defines ticket completion.
- [ ] Blast-radius is scoped to bulk/destructive data operations, including checks before any live operation and an explicit not-applicable outcome.
- [ ] The change is committed and pushed on a new branch based on current main.

## Dependencies

- [Project ticket skill](../../.agents/skills/tatr-ticket/SKILL.md).
- [Project Git workflow](../../.agents/skills/git-workflow/SKILL.md).
- Matt Pocock's grill-with-docs, grilling, domain-modeling, implement, tdd, codebase-design, and code-review skills.
- [Blast radius](https://github.com/kishormorol/blast-radius/blob/main/SKILL.md).
- [ADR Tools](https://github.com/npryce/adr-tools).

## Definition of Done

- [ ] All acceptance criteria have evidence recorded.
- [ ] ADR CLI creation and TATR parsing have been checked without changing live data.
- [ ] Workflow references and the staged diff pass their applicable checks.
- [ ] The signed branch is pushed and the PR is available for review.

Implementation state: setup ready for review on feature/implementation-flow. Review base: cafbcef8592a1cb802e541fe46a88eb2aff6c06e. No end-to-end product implementation run is claimed by this setup ticket.

### Setup evidence

- `python3 /tmp/check-implementation-flow.py`: required skills, local Markdown links, and ADR configuration passed; isolated ADR init/new/supersession passed.
- `/home/ragemous3/projects/tatr/build/tatr ls :task`: parsed this OPEN ticket with priority 100 and the task tag.
- `git diff --check`: passed. Product source is unchanged; product tests are not exercised by this setup.
- ADR Tools source revision: b3279baf9be2207d1a4f4bbd608fd0b591c72aee. User-local installation exposes `adr` on PATH.
- Review and publication are pending. Blast-radius applicability: documentation and tool setup introduce no bulk writes on real application data.
