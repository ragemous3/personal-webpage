# Implementation flow

Use this flow for feature work and bug fixes. Invoking `implementation-flow` authorizes its skills within the requested scope and execution permissions. Design approval does not authorize publication.

```text
ticket gate → grill-with-docs → tatr-ticket → choose Guided or Autopilot
                                                ↓
implement → deslop → runtime verification → code-review → blast-radius
    ↑                                           │              │
    └── fixes ──────────────────────────────────┴── fixes ──────┘
                                                               ↓
                                                    show-me → PR → handoff
```

## Execution rules

This workflow owns stage order, check timing, reviews, commits, publication, and closure. Skills supply each stage's method. Read each required `SKILL.md` before use; see [setup and sources](implementation-setup.md).

- Follow stages 0–7. After a stage passes, continue without another approval pause. Skip, replace, or reorder a required step only with explicit user approval recorded in the ticket.
- Use the TATR ticket as the spec. Resume its recorded stage after the ticket gate. Return to stage 1 for unresolved requirements or changed scope/interfaces. Reuse recorded approvals; silence or elapsed time is not approval.
- On stage entry and completion, record the stage, latest implementation SHA, checks and review SHAs, and next action. Commit these records with work snapshots. Keep the review-base SHA fixed.
- Before an implementation fix, invalidate both code-review results, blast-radius review, and the final test result. Return through stages 3–7. Ticket status/evidence updates and PR-text edits alone do not invalidate them.
- A failed or blocked requirement cannot pass. Follow the stage's failure route. If a required decision has no rule, or an action exceeds authorization, stop that action, record the blocker, and ask the user.

The main agent owns decisions and publication. Review delegates are read-only. No mode authorizes merge, auto-merge, a merge queue, deployment, or live destructive operations. Each needs separate explicit approval.

## Mode and decision lookup

At the end of stage 2, offer Guided or Autopilot. For a resumed ticket, retain its mode; if absent, select one after requirements are sufficient. A mode change needs the user's choice.

Guided uses existing approval rules. Before activating Autopilot, obtain explicit approval for routine implementation decisions, tests, cleanup, review fixes, in-scope documentation/comments/ticket updates, signed commits, branch pushes, PR creation/updates, and CI/review fixes through handoff. Record the mode, grant, scope, limits, and finish condition in the ticket body. An absent or ambiguous grant cannot activate Autopilot.

At every point below, run the [decision CLI](../scripts/implementation-decision.js) from the repository root. Set `FLOW_MODE` to the ticket's `guided` or `autopilot` value. Before selection, use `guided` and honor existing approvals.

```sh
node scripts/implementation-decision.js --mode "$FLOW_MODE" <decision-id>
```

| Point | Decision ID |
| --- | --- |
| Stage 2 passes; also before resuming a prepared ticket | `after-ticket` |
| Before documentation, comment, docstring, or ticket edits | `before-documentation-change` |
| Stage 3 passes | `after-implementation` |
| Stage 4 passes | `after-verification` |
| Stage 5 passes | `after-code-review` |
| Stage 6 passes | `after-blast-radius` |
| Before publication, including closure push | `before-publish` |
| Stage 7 handoff | `after-publish` |

Follow stdout when present. Exit 0 with empty stdout adds no instruction. A nonzero exit blocks progress until the lookup is fixed. The CLI retrieves instructions; it grants no permission. Apply it on fix passes and resumption too. Keep shared requirements here, not in the [mode maps](implementation-modes/decisions.json).

## 0. Check existing tickets

- **Action:** Search OPEN and CLOSED `tasks/*/TASK.md` for similar behavior, affected areas, and acceptance criteria. Read plausible matches. Show each match's path, title, status, stage, and overlap. Obtain the user's choice: resume/update/reopen, create a distinct linked ticket, or stop. Reuse an existing choice.
- **Output:** Search result and the selected ticket or agreed new scope.
- **Pass:** No match exists, or the user selected a ticket action. Continue to stage 1 for new design; otherwise resume the recorded stage. Select a missing mode and run `after-ticket` before resuming a prepared ticket.
- **Failure:** If the user chooses stop, end the workflow. Otherwise stay here until the choice is explicit. Recheck this gate before ticket creation if design changes the scope.

## 1. Confirm the design

- **Action:** Run `grill-with-docs`. Inspect relevant code and domain docs before asking questions. Confirm behavior, scope, constraints, acceptance criteria, dependencies, and test seams with the user. Explain each seam's coverage and gaps. Map each implementation criterion to focused check commands, including relevant type checks. Record the final full-suite command and runtime journeys. Agree how to add a missing harness or verify the change. Update domain docs under the skill's glossary/ADR rules.
- **Output:** User-confirmed design, seams, check mapping, prerequisites, and relevant domain-doc links.
- **Pass:** The user confirms the design and verification plan. Continue to stage 2.
- **Failure:** Stay here for unresolved requirements or test coverage decisions. Design confirmation grants no external-action permission.

## 2. Prepare the ticket and branch

- **Action:** Use [tatr-ticket](../.agents/skills/tatr-ticket/SKILL.md) to create or update the selected ticket. Read it back against the design. Use [git-workflow](../.agents/skills/git-workflow/SKILL.md) to branch from fetched `origin/main`; an existing branch or user-specified base takes precedence. Record the branch and initial merge-base as a full SHA. Select the mode.
- **Output:** Valid TATR Markdown containing the design, check mapping, seams, dependencies, branch, fixed review base, mode, approval scope, and next stage. Keep one independently verifiable outcome per ticket; link dependent tickets.
- **Pass:** The ticket matches the confirmed design and all output fields are present. Run `after-ticket`; continue to stage 3.
- **Failure:** Fix ticket or branch setup here. Return design gaps to stage 1. Missing approval blocks only the action that needs it.

## 3. Implement

- **Action:** Run the project [implement skill](../.agents/skills/implement/SKILL.md), not the global skill of the same name. Supply the full ticket path, mode, and approved scope. Use its TDD and focused-check procedure.
- **Output:** Changes for the implementation criteria, with focused check commands and results in the ticket.
- **Pass:** All implementation criteria are met and their focused checks pass. Review and publication criteria belong to later stages. Run `after-implementation`; continue to stage 4.
- **Failure:** Fix implementation or check failures here. A missing tool or harness blocks the stage. Return scope, interface, or verification-plan changes to stage 1.

## 4. Clean up and verify runtime behavior

- **Action:** Run local [deslop](../.agents/skills/deslop/SKILL.md) against the fixed base, including staged and unstaged changes. Run affected focused checks after cleanup. For runtime changes, use [verify-offline-assistant](../.agents/skills/verify-offline-assistant/SKILL.md) on the real application. Observe each required user action and result. Record entry points, commands, expected/actual results, evidence paths, and source revision. Mocks or server startup alone cannot prove a journey. If runtime is unaffected, record why. Create a signed snapshot with git-workflow after these checks.
- **Output:** Committed implementation and cleanup, with check evidence tied to that snapshot. Record limitations and any user-approved alternative verification.
- **Pass:** Cleanup and affected checks pass. Required journeys pass, have an approved alternative, or are inapplicable with a reason. All intended implementation files are committed. Run `after-verification`; continue to stage 5.
- **Failure:** Return behavioral defects to stage 3, then repeat this stage. For other failed or blocked journeys, stay here, keep the ticket OPEN, and record the blocker and prerequisite ticket. Resolve it or obtain approval for alternative verification. Do not expand a verification-only ticket to include product fixes.

## 5. Review standards and spec

- **Action:** Run `code-review` against `git diff <fixed-base>...HEAD`. Supply the full TATR ticket path and project standards. Use the skill's parallel, read-only Standards and Spec reviewers.
- **Output:** Both review results, findings, and dispositions tied to the reviewed SHA. Resolve judgment calls with evidence or a recorded decision.
- **Pass:** Both reviews have zero unresolved actionable findings for the latest implementation snapshot. Run `after-code-review`; continue to stage 6.
- **Failure:** Return actionable findings to stage 3 on the same ticket and branch. Repeat cleanup, runtime verification, and both reviews. Missing review evidence blocks this stage.

## 6. Review blast radius

- **Action:** Load `blast-radius`. Assess bulk or destructive operations on real data. If applicable, follow its checks using read-only evidence or isolated fixtures. Otherwise record why it does not apply. Its pre-operation checks also apply before any real bulk write in earlier stages; this review does not replace them.
- **Output:** Applicability, evidence, findings, and dispositions tied to the reviewed SHA.
- **Pass:** No unresolved applicable findings remain, or non-applicability is recorded. Run `after-blast-radius`; continue to stage 7.
- **Failure:** Return implementation fixes to stage 3 and repeat both reviews. If data cannot support a safe decision, stop the affected operation, keep the ticket OPEN, and record the missing evidence.

## 7. Test, publish, and close

- **Action:** Complete these steps in order:
  1. Record acceptance-criteria and Definition of Done evidence in the ticket. Read `show-me` and prepare the PR title and body from the final diff. Follow the [PR template](../.github/pull_request_template.md) and ASD-STE100 Simplified Technical English. Use the smallest useful diagram or example. Keep verification results in the ticket, not the PR body. Record which snapshot the body describes; use accessible links instead of local temporary paths.
  2. Run the ticket's full-suite command once, after reviews and before push. Record the command, result, and tested implementation SHA. Reuse a passing result only if no implementation changed; ticket status/evidence and PR-text edits alone do not require another run.
  3. Run `before-publish` and satisfy its instructions. Reuse publication approval already given. Use git-workflow for signed commits and branch push. Create or update the branch's existing PR. Before every push to an existing PR, check auto-merge and merge-queue state; stop if either could merge without authorization.
  4. After the branch is pushed and the PR is open, set the ticket to CLOSED. Record the PR URL and completed stage. Sign and push the closure commit to the same branch. Do not wait for PR approval or merge.
  5. Read back the PR body and compare it with the prepared text. Use the existing git-workflow watcher for CI and actionable review findings on the current head. Do not add another watcher. Pending human review alone does not reopen the ticket. Run `after-publish` at handoff.
- **Output:** Open, unmerged PR; CLOSED ticket pushed to its branch. Report the PR URL, final head SHA, verification evidence, ticket status, and readiness or remaining blocker.
- **Pass:** Publication and closure pushes succeed, the body matches, required checks pass, and no actionable findings remain. Report whether the PR is ready for review or waiting for required human approval. Do not merge.
- **Failure:** A failed or blocked full-suite run prevents push. Keep the ticket OPEN. Any CI failure or actionable review finding reopens the same ticket. Route implementation fixes through stages 3–6, refresh the PR body, and repeat this stage. Resolve other blockers here. Publication failure leaves the ticket OPEN. If the closure push fails, restore OPEN locally, record the blocker, and retry after resolution. Never report blocked work as complete.
