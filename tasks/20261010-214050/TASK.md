# Connect design interviews to the TATR implementation flow

- STATUS: CLOSED
- PRIORITY: 100
- TAGS: task

## Background

Connect the project's design interview to a native TATR implementation ticket and a repeatable implementation/review workflow. The requested order is grill-with-docs → tatr-ticket → implement → code-review → blast-radius, with review findings returning to implementation. Preserve the resolved requirements in the ticket and use ADR Tools to create architectural decision records.

## Prerequisites

The existing project tatr-ticket and git-workflow skills are merged into main. Install Matt Pocock's required global skills and dependencies, the linked kishormorol/blast-radius skill, and npryce/adr-tools. This setup changes documentation and tooling only; a feature's public test seams will be agreed during its own grilling stage.

## Acceptance criteria

- [x] AGENTS.md directs agents to an implementation-flow with the requested stage order and both fix loops.
- [x] The TATR ticket is the spec passed to implement and code-review, including confirmed test seams and ADR links.
- [x] Required global skills and their dependencies are installed with supporting files.
- [x] The adr command is available and ADR creation uses the CLI under docs/adr.
- [x] The flow pins a review base, reviews committed changes, repeats both reviews after fixes, and defines ticket completion.
- [x] Blast-radius is scoped to bulk/destructive data operations, including checks before any live operation and an explicit not-applicable outcome.
- [x] The change is committed and pushed on a new branch based on current main.

### Execution-mode extension approved 2026-10-27

The user approved Guided/Autopilot selection after ticket preparation, persistent mode/authorization, and HumanLayer show-me for the final PR body. The user then selected a CLI lookup instead of Markdown instruction tables and chose to extend this ticket. AGENTS.md is explicitly outside scope; mode selection must obtain the explicit approval its existing rule requires.

- [x] A CLI accepts an explicit mode and stable decision ID, prints the applicable instruction, and prints nothing for a known decision with no extra instruction. Invalid input or missing/invalid configuration fails with a nonzero exit code rather than silently continuing.
- [x] Guided instructions live in a separate data file; Autopilot's instruction map is empty. Shared scope, verification, review, and no-merge requirements remain in the flow.
- [x] The flow offers the choice after creating/selecting a sufficiently specified ticket, records the explicit choice and authorization, and reuses it through fixes and resumed sessions. Missing authorization never defaults to Autopilot.
- [x] Workflow steps call the CLI at named decisions, including before documentation changes and publication. A CLI lookup does not grant permission or perform an action.
- [x] Global implement/SKILL.md and AGENTS.md stay unchanged. Autopilot obtains explicit, ticket-scoped approval within the flow rather than overriding repository instructions.
- [x] Both modes prepare the final PR description through show-me and use the existing Git workflow for publication and CI/review handoff, without merging.
- [x] CLI subprocess tests cover visible output, empty output, invalid input, and configuration failures. Check documentation links and decision IDs. Product runtime checks are not applicable to this tooling change.

Extension state: complete. [PR #8](https://github.com/ragemous3/personal-webpage/pull/8) merged as ab5c0a9a17eb59c463b44a4639bd5e7114a8f65e. Extension review base: 3d552edc4bbe5318ffacdc650187fb0257958e00. Execution mode: guided. AGENTS.md and the installed implement skill are unchanged. Reviewed extension implementation snapshot: 30bc55205ab186244b597a4506a99e1f2b2b13d8. Earlier review results below cover the original workflow only.

Extension evidence:

- `node --test tests/implementation-decision.spec.js`: 5 tests passed, 0 failed, exercising the real CLI in subprocesses, including invalid configuration and empty output.
- Local link/decision validation: 8 local links and all 8 decision IDs passed; Autopilot map is empty. `git diff --check`: passed.
- `npm test`: blocked before tests execute by the existing incomplete TypeScript installation (`ERR_MODULE_NOT_FOUND`). The dependency-free CLI suite above is the applicable test suite for this change; no product source changed.
- Deslop cleanup retained required configuration validation and aligned formatting with surrounding JavaScript. Application browser journeys are not applicable to the workflow CLI; the included verification skill remains a draft with live-run blockers in its separate ticket.
- HumanLayer show-me and Cursor deslop are installed globally. The PR body was prepared with show-me against implementation snapshot 30bc55205ab186244b597a4506a99e1f2b2b13d8, using a Mermaid flow and the actual verification limitations.
- Final combined snapshot validation: 31 local links across nine Markdown files passed, draft skill structure is valid, helper syntax checks passed, and `git diff --cached --check` passed. The retained Hugo log has whitespace normalized.
- Parallel Standards review: 0 actionable findings on 30bc552. Parallel Spec review: 0 actionable findings on the same snapshot, including the explicitly approved draft scope.
- Blast-radius on 30bc552: not applicable to bulk/destructive writes on real data. The CLI reads local configuration; observation cleanup removes only its own temporary browser profile. No live data operation was performed.
- Signature header check passed for 30bc552. PR body prepared locally at `/tmp/workflow-execution-modes-pr-body.md`; regenerate it from this snapshot and evidence if that temporary file is absent.
- PR #8 was published with the show-me-prepared body, reviewed, and merged. The draft application verification remains OPEN in [its separate ticket](../20261027-104746/TASK.md).

Next action: none for this workflow ticket. Continue application verification under its separate ticket when its prerequisites are ready.

## Dependencies

- [Project ticket skill](../../.agents/skills/tatr-ticket/SKILL.md).
- [Project Git workflow](../../.agents/skills/git-workflow/SKILL.md).
- Matt Pocock's grill-with-docs, grilling, domain-modeling, implement, tdd, codebase-design, and code-review skills.
- [Blast radius](https://github.com/kishormorol/blast-radius/blob/main/SKILL.md).
- [ADR Tools](https://github.com/npryce/adr-tools).

## Definition of Done

- [x] All acceptance criteria have evidence recorded.
- [x] ADR CLI creation and TATR parsing have been checked without changing live data.
- [x] Workflow references and the staged diff pass their applicable checks.
- [x] The signed branch is pushed and the PR is available for review.
- [x] The workflow PR is reviewed and merged through the project Git workflow.

Historical original workflow state: [PR #5](https://github.com/ragemous3/personal-webpage/pull/5) merged as 9ae6426d1c4c917a5d8b2a7254860e9a607d053b. Review base: cafbcef8592a1cb802e541fe46a88eb2aff6c06e. Reviewed implementation snapshot: 0dc950d. No end-to-end product implementation run is claimed by this setup ticket.

### Setup evidence

- `python3 /tmp/check-implementation-flow.py`: required skills, local Markdown links, and ADR configuration passed; isolated ADR init/new/supersession passed.
- `/home/ragemous3/projects/tatr/build/tatr ls :task`: parsed this OPEN ticket with priority 100 and the task tag.
- `git diff --check`: passed. Product source is unchanged; product tests are not exercised by this setup.
- ADR Tools source revision: b3279baf9be2207d1a4f4bbd608fd0b591c72aee. User-local installation exposes `adr` on PATH.
- Review of 4cfbd54: Standards found no issues; Spec found one stage-persistence gap. The flow now requires stage and review-SHA updates at every handoff and invalidates both reviews on a fix pass. Both original review results are invalidated pending review of the new snapshot.
- Repeat review of 0dc950d: Standards 0 findings, Spec 0 findings; neither axis has an unresolved issue.
- Blast-radius on 0dc950d: not applicable, because documentation and tool setup introduce no bulk writes on real application data. No live data operation was performed.
- Signed snapshots 4cfbd54 and 0dc950d were pushed on feature/implementation-flow, based on the pinned main SHA. PR #5 is open against main. Subsequent ticket evidence updates do not change the reviewed implementation.
