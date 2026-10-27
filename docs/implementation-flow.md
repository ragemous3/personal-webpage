# Implementation flow

Use this flow for feature work and bug fixes. Begin with the existing-ticket gate in stage 0. Invoking `implementation-flow` authorizes the stages below, including the user-invoked `grill-with-docs`, `implement`, and `show-me` skills, within the user's requested scope and execution permissions. Choose the execution mode after ticket preparation; approval of the design alone does not authorize publication.

```text
ticket gate → grill-with-docs → tatr-ticket → choose Guided or Autopilot
  → implement → deslop → runtime verification → code-review → blast-radius
  → show-me → full test suite → push → PR → close ticket → push → handoff

Review findings or failed tests → implement → repeat checks and both reviews
```

The TATR ticket is the implementation spec and the handoff between stages. Keep the same ticket through fixes. When the user chooses an existing ticket, resume it at its recorded stage; return to grilling when a requirement or scope decision is unresolved.

Update the ticket whenever entering or completing a stage: record the current stage, latest implementation snapshot SHA, completed checks/reviews and their SHAs, and next action. Commit these updates with the work snapshots so another session can resume. When returning to implementation for fixes, mark both previous review results invalid before changing the implementation; later stages must review the new snapshot.

## Execution mode

Offer Guided or Autopilot when a new ticket is ready at the end of stage 2. For an existing ticket, first complete stage 0 and confirm its requirements are sufficient to resume, then make the same choice if none is recorded. A choice already made for this ticket remains valid through fix passes and resumed sessions. If requirements need design work, finish that work before selecting Autopilot.

Guided retains the current approval rules. When offering Autopilot, explicitly ask the user to approve routine implementation decisions, applicable tests, cleanup, review fixes, in-scope documentation/comments/ticket updates, signed commits, pushing the task branch, creating or updating its PR, and handling its CI/review findings through handoff. Wait for that approval before activating Autopilot. This obtains the approval required by the existing AGENTS.md; it does not modify or override that file. Record the mode, the user's approval, authorized scope, limits, and the finish condition in the ticket body; these are workflow fields, not new TATR header properties. Changing mode requires the user's choice.

Both modes use the same implementation and verification stages. Continue when a stage is complete; there is no automatic approval pause between every pair of stages. Ask when requirements or interfaces change, a necessary action exceeds authorization, or a blocker cannot be resolved within scope. Missing verification and unresolved actionable review findings remain blockers. End with an open PR, a closed ticket pushed to its branch, and an accurate readiness report; merging, enabling auto-merge, entering a merge queue, deployment, and live destructive operations require separate explicit authorization.

No mode decision rewrites an installed skill. Pass the ticket, mode, approved scope, and this flow's stage order when invoking `implement` or delegating work. The main agent owns decisions and publication; review delegates remain read-only. Preserve approval records on resumption. An absent or ambiguous grant never authorizes Autopilot or publication.

## Decision lookup

Use the [decision CLI](../scripts/implementation-decision.js) at each named point below and immediately before documentation/comment/docstring/ticket changes or publication. Run it from the repository root, setting `FLOW_MODE` to the ticket's selected `guided` or `autopilot` value. During design, before a mode is selected, use `guided` and honor any approval already given for the requested work.

```sh
node scripts/implementation-decision.js --list
node scripts/implementation-decision.js --mode "$FLOW_MODE" before-documentation-change
```

The [decision registry](implementation-modes/decisions.json) gives stable IDs. [Guided](implementation-modes/guided.json) contains extra approval instructions; [Autopilot](implementation-modes/autopilot.json) is an empty object. These JSON maps replace Markdown instruction tables. At a decision point, read and follow stdout when present. Exit 0 with empty stdout means no extra instruction: continue only if the shared requirements and existing authorization permit it. A nonzero exit is a lookup failure; resolve it before proceeding. Do not treat missing files, an invalid mode, or a misspelled ID as an empty instruction.

The CLI only retrieves instructions. It neither selects a mode nor grants permission or executes an action. Keep shared checks and stop conditions in this flow, not in the mode maps. Use the same lookup on every relevant fix pass and after resumption.

## Required skills and tools

Read each stage's installed `SKILL.md` when entering that stage. The project supplies `tatr-ticket` and `git-workflow` under `.agents/skills/`. Install the following global skills with their supporting files:

| Source repository | Skill directory | Purpose |
| --- | --- | --- |
| `mattpocock/skills` | `skills/engineering/grill-with-docs` | Design interview and domain documentation |
| `mattpocock/skills` | `skills/productivity/grilling` | Interview dependency |
| `mattpocock/skills` | `skills/engineering/domain-modeling` | Glossary and ADR dependency |
| `mattpocock/skills` | `skills/engineering/implement` | Implement the ticket |
| `mattpocock/skills` | `skills/engineering/tdd` | TDD at agreed seams |
| `mattpocock/skills` | `skills/engineering/codebase-design` | Interface and seam design reference used by TDD |
| `cursor/plugins` | [`cursor-team-kit/skills/deslop`](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/deslop/SKILL.md) | Clean up introduced code before review |
| `cursor/plugins` | `pstack/skills/create-verification-skill` | Create project-specific runtime verification instructions when missing |
| `mattpocock/skills` | `skills/engineering/code-review` | Standards and spec review |
| `kishormorol/blast-radius` | Repository root | Review bulk operations on real data |
| `humanlayer/skills` | [`plugins/show-me/skills/show-me`](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md) | Prepare the final PR body's visual explanation |

If a required skill is missing, identify it before beginning its stage. The issue tracker is already configured here: local TATR Markdown files, with the selected ticket's full path supplied to `implement` and `code-review`.

For application runtime checks, use the project [verify-offline-assistant skill](../.agents/skills/verify-offline-assistant/SKILL.md) and its feature map. It is currently a draft; [its ticket](../tasks/20261027-104746/TASK.md) records the prerequisites for the first successful live run. Generate verification instructions once and maintain them as the application changes, rather than running the generator for every ticket.

Use [npryce/adr-tools](https://github.com/npryce/adr-tools) for ADR creation. Its `adr` command must be on PATH. `.adr-dir` selects `docs/adr`. On another machine, install ADR Tools using its [installation instructions](https://github.com/npryce/adr-tools/blob/master/INSTALL.md); the Git installation adds the downloaded repository's `src/` to PATH. TATR's CLI is optional for creating tickets because the project skill includes a Python helper; use the CLI when available to list and inspect them.

## 0. Check for existing tickets

Before beginning design, creating a ticket, or implementing work, search existing `tasks/*/TASK.md` files, including OPEN and CLOSED tickets, for the same or similar work. Compare the requested behavior, affected area, and acceptance criteria; read plausible matches rather than relying only on titles or exact wording.

If a similar ticket exists, show its path, title, status, recorded stage when available, and a short explanation of the overlap. Ask the user how to proceed: resume or update an existing ticket, reopen a closed ticket, create a separate ticket with distinct scope and a link to the related work, or stop. Wait for an explicit choice before continuing. Honor a choice already made in the current conversation without asking again.

If no similar ticket exists, report that result and continue to stage 1. Finish this gate only when the search found no similar tickets or the user has chosen how to handle the matches. Recheck before ticket creation if the agreed scope changed during design.

## 1. Grill and record decisions

Run `grill-with-docs`, which loads `grilling` and `domain-modeling`. Read the relevant code and existing domain docs before asking questions the repository can answer. Work through the design in rounds and wait for the user's answers.

Resolve the intended behavior, constraints, scope, acceptance criteria, dependencies, and test seams. For each proposed seam, explain what it catches and misses. Record which seams the user confirmed; if the repository has no suitable test harness, agree how it will be introduced or how this change will be verified.

Update the glossary as terms settle. Create ADRs when the domain-modeling criteria apply: a meaningful cost to reverse, surprising without context, and a real trade-off. For a new decision, use the CLI:

```sh
VISUAL=true EDITOR=true adr new 'Decision title'
# To replace decision 2:
VISUAL=true EDITOR=true adr new -s 2 'Replacement decision title'
```

Fill the generated record with the agreed decision, alternatives, trade-offs, and consequences using the domain-modeling ADR guidance. Preserve the CLI's number and supersession links. Link relevant records in the ticket. `.adr-dir` is already initialized; use `adr init docs/adr` only when configuring a new repository.

Finish this stage when the user confirms shared understanding, including the scope and test seams. This confirmation approves the design handoff; it does not expand authorization for external actions.

## 2. Create the TATR ticket

Use the project `tatr-ticket` skill to create a native `tasks/<HUID>/TASK.md`, choosing a task or bug template as appropriate. Put the agreed behavior and constraints in the ticket rather than relying on conversation history. Capture confirmed seams, verification commands or agreed verification work, dependencies, and glossary/ADR links within the selected template's sections.

Read the completed ticket back and check it matches the confirmed design. Preserve one independently verifiable outcome per ticket; link dependent tickets when a split is needed. Use the ticket's acceptance criteria as the spec for both implementation and review.

Start a feature branch from fetched `origin/main` using the project git-workflow skill. Pin its initial merge-base with `origin/main` as a full commit SHA in the ticket, together with the branch and current stage. Keep that review base fixed through all implementation and fix iterations. An existing branch or user-specified base takes precedence.

Finish when the ticket is valid TATR Markdown, its requirements and seams are recorded, and the branch and review base are known.

Select and record the execution mode as described above, then run `node scripts/implementation-decision.js --mode "$FLOW_MODE" after-ticket`. Do this for a resumed ticket too, before returning to its recorded stage.

## 3. Implement with TDD

Load `implement` and pass the full TATR ticket path; state its title before starting. Use `tdd` at the confirmed seams, consulting `codebase-design` when the interface needs design work. Work in vertical slices: one failing behavioral test, enough implementation to pass it, then the next slice. Changes to the agreed interface or scope return to the user and update the ticket before implementation proceeds.

Discover checks from the repository configuration. Run relevant type checks and focused tests during implementation. Record commands, results, and missing tools. A missing test harness is a prerequisite to resolve. It is not a passing test run.

This project flow controls cleanup, review order, and completion. Override `implement`'s default review-then-commit timing: stage 4 runs deslop, verifies applicable runtime behavior, and creates a signed implementation snapshot before code-review so its committed `HEAD` diff includes the cleaned-up, verified work. Stage 5 satisfies `implement`'s code-review step; run it once per snapshot.

Stage 7 satisfies `implement`'s requirement to run the full test suite once at the end. Run that check after both reviews and before push.

Finish when the ticket's implementation is complete and applicable checks pass.

Run `node scripts/implementation-decision.js --mode "$FLOW_MODE" after-implementation` before stage 4.

## 4. Clean up and verify runtime behavior

Load [deslop](https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/deslop/SKILL.md) before every code-review pass, including after implementation fixes. Use the ticket's pinned review-base SHA in place of the skill's default comparison against main, and inspect all introduced changes, including staged and unstaged implementation work.

Make focused edits to remove unnecessary comments, redundant defensive code, type-check bypasses, avoidable nesting, and patterns inconsistent with the surrounding code. Preserve the ticket's required behavior and necessary validation. Route any discovered behavioral bug through implementation with relevant regression coverage, then repeat deslop.

Rerun the type checks and focused tests affected by cleanup.

For changes affecting application runtime behavior, run the relevant journeys in `verify-offline-assistant` against the real application after cleanup. Record the entry points exercised, actions, observed results, evidence paths, and source revision. Observe both the user action and its result; mocked tests and a successful server start do not establish a working user journey. Recheck affected behavior after fixes. For changes with no runtime effect, record why this check is not applicable.

If a required journey cannot run or fails, record the exact blocker and prerequisite ticket, keep the implementation ticket OPEN, and resolve it or agree on alternative verification before advancing to code-review. A draft verification skill, missing data, or unavailable browser/model does not count as a pass. Route product fixes through their applicable tickets; do not silently expand a verification-only task.

Record cleanup and verification in the ticket, then create a signed implementation snapshot using git-workflow, including cleanup edits. Associate the evidence with that snapshot and note any remaining limitations. Finish when cleanup is complete, applicable checks and runtime journeys pass (or an agreed alternative is recorded), and all intended implementation changes are committed for review.

Run `node scripts/implementation-decision.js --mode "$FLOW_MODE" after-verification` before code-review.

## 5. Review standards and spec

Run `code-review` with the pinned review-base SHA and the TATR ticket path as its spec source. It compares `git diff <base>...HEAD`; include all intended implementation files in the committed snapshot first. Supply the project standards sources and the local TATR tracker context. Follow the skill's separate Standards and Spec reviews, including its parallel reviewers.

Record findings against the reviewed commit. Return actionable findings to `implement` as a scoped fix pass on the same ticket and branch. Preserve the agreed seams, add relevant regression coverage, rerun checks, and pass through deslop and its signed snapshot before restarting code-review. Resolve judgement calls with evidence or a documented decision; do not silently discard them.

Finish when both review axes have no unresolved actionable findings for the latest implementation snapshot.

Run `node scripts/implementation-decision.js --mode "$FLOW_MODE" after-code-review` before blast-radius.

## 6. Review blast radius

Load `kishormorol/blast-radius`. Review whether the implementation can perform bulk or destructive writes on real data, including queued jobs, batch messages, permission changes, and deletion scripts. If none apply, record that finding with its reason and the reviewed commit in the ticket.

When applicable, follow the skill: justify the filter, classify affected records as act/exclude/unknown, inspect dependencies, check dry-run and apply separation, and verify guards against ambiguity, repeated side effects, and the wrong environment. Examine code and use read-only evidence or isolated fixtures. Applying a live operation follows the user's explicit scope and authorization.

This final stage does not replace the skill's pre-operation check: perform its checks before any real bulk write during earlier stages too. The optional Claude-specific hook is separate setup and is not required by this workflow.

Return findings to `implement` as scoped fixes. After fixes, rerun deslop, code-review, and then blast-radius; a later implementation change invalidates both prior reviews. If the data cannot support a safe decision, keep the ticket OPEN, record the missing evidence, and stop the affected operation.

Finish when all applicable blast-radius findings are resolved or the stage is explicitly recorded as not applicable.

Run `node scripts/implementation-decision.js --mode "$FLOW_MODE" after-blast-radius` before preparing the PR.

## 7. Prepare the PR, publish, and hand off

Record acceptance-criteria evidence, check results, reviewed commit IDs, dispositions for review findings, and blast-radius applicability in the ticket. Update its current stage so another session can resume accurately. Keep the ticket OPEN until the checks before publication pass and the PR is open.

Prepare the PR title and full body before asking for publication approval. Read the installed `show-me/SKILL.md` and apply it to the final diff and evidence. Lead with the problem and resulting behavior, use the smallest useful diagram or before/after sketch, include the TATR ticket path, actual verification results, and remaining limitations, and honor any repository PR template. This is a writing pass, not an automated verifier. Record in the ticket which implementation snapshot the body describes. Local temporary paths are not usable PR attachments; include relevant output or accessible artifact links. Repeat the show-me pass whenever later fixes change what the body describes.

Run the full test suite as the final verification step before push. Both reviews must be complete first. Record the command, result, and tested implementation snapshot SHA in the ticket. Update the prepared PR body with the result. A failed or blocked run prevents push. Keep the ticket OPEN until the required checks pass.

If a test failure requires an implementation change, return to stages 3 through 6. Repeat cleanup, applicable runtime checks, and both reviews for the new snapshot. Refresh the PR body. Then run the full test suite again. A passing result remains valid while the implementation is unchanged. Changes to ticket records or PR text alone do not require another run.

Run `node scripts/implementation-decision.js --mode "$FLOW_MODE" before-publish`. In Guided, honor prior publishing approval or present the prepared result and wait for it. In Autopilot, the explicit ticket-scoped grant covers publication. Use git-workflow for signed commits, push, and PR creation/update; reuse an existing PR for the branch. Before pushing an existing PR, check whether auto-merge or a merge queue could merge it automatically; pause to resolve that situation if merging is outside the user's grant.

After the branch is pushed and the PR is open, set the ticket to CLOSED. Record the PR link and the completed stage in the ticket. Create a signed commit for the closure and push it to the same PR branch. Close the ticket at this point as standard practice. Do not wait for PR approval or merge. If the push or PR creation fails, keep the ticket OPEN and record the blocker.

Read back the published PR body and verify that it matches the show-me-prepared text. Use the existing git-workflow watcher to handle CI and actionable review findings on the current head. Reopen the same ticket if CI fails or review identifies work to do. Any implementation change returns to stages 3 through 6 and refreshes the PR description. Resolve the findings and pass the required checks before closing the ticket again. Commit and push each closure to the same PR branch. Waiting for PR review alone does not reopen the ticket. Do not introduce a second watcher.

At handoff, run `node scripts/implementation-decision.js --mode "$FLOW_MODE" after-publish`. Report the PR link, final head SHA, verification evidence, ticket status, and whether it is ready for review, waiting for required human approval, or blocked. The successful finish is an open, unmerged PR and a closed ticket pushed to its branch; never report a blocked run as complete. No-answer or elapsed time is not approval. This flow does not authorize merging.
