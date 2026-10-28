# Run the full test suite before push

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The implementation flow requires the full test suite during implementation and after cleanup. These instructions cause repeated test runs. The user approved one final run after the reviews and before push.

Change [the implementation flow](../../docs/implementation-flow.md). Remove the early instructions to run the full test suite. Keep focused tests during implementation and cleanup. Add one final test step before push.

Related work: [Connect design interviews to the TATR implementation flow](../20261010-214050/TASK.md). That ticket is CLOSED.

Scope extension approved by the user: make ticket closure a standard part of PR publication. After the branch is pushed and the PR is open, close the ticket. Record the PR link, commit the closure, and push it to the same PR. Do not wait for PR approval or merge. Reopen the same ticket if CI or review requires more work. Update this PR in Simplified Technical English and use show-me to explain the sequence.

PR review fixes requested by the user: restore the original overview diagram. Keep the test timing instructions in the stage text. Use a local deslop skill instead of the external link. The existing show-me stage stays in place.

PR template extension approved by the user: add a default GitHub PR description template. Use Change, Explanation, and Other as section names. Explain the problem, why it matters, and the resulting behavior. Make Explanation and Other optional. Use show-me when a diagram or example helps. Require ASD-STE100 Simplified Technical English, short sentences, and active verbs. Omit verification from the PR body; retain check evidence in this ticket. Link to the ticket for background and acceptance criteria. The optional Theo reference has not been identified, so this template does not claim to use it.

Workflow simplification approved by the user: give the workflow sole control of stage order, checks, reviews, commits, publication, and closure. Add a local implement skill that handles implementation and focused checks. Give each stage an action, required output, pass condition, and failure destination. Replace vague timing with recorded commands and explicit triggers. Move setup instructions to a reference. Remove duplicate skill instructions. Keep verification evidence in this ticket and use the PR template for the body.

## Prerequisites

The user approved the requirements and the documentation changes in this conversation. Use Guided mode. The user explicitly authorized pushing the task branch and opening a PR. Merging is not authorized.

Branch: `feature/final-test-step`. Fixed review base: `bf479770f675667d331eec2462a1138237d641c5`. A fetch of `origin/main` confirmed this base.

Current stage: cleanup and focused verification are complete for the workflow simplification. Create the signed implementation snapshot, then run both reviews for [PR #13](https://github.com/ragemous3/personal-webpage/pull/13). Both previous review results are invalid for this extension. SSH commit signing is configured. Local signature verification passed for earlier commits. GitHub recognition of the signature has not been verified.

Focused check mapping: all six simplification criteria use `node /tmp/final-test-workflow-check.cjs` and `git diff --check`, followed by Standards and Spec review. The first command checks structure and references; review assesses meaning and preserved controls. No type-check command or behavioral TDD seam applies to these Markdown changes. No application files changed.

Focused check output:

```text
PASS: 19 local links; original diagram; 8 stages with 4 fields; 8 decision IDs in both modes; 2 skill headers; PR template.
```

Both focused commands exited 0. Cleanup removed repeated skill instructions and retained the original diagram. The main workflow is reduced from 2,988 to about 1,800 words. Setup is in `docs/implementation-setup.md`. The local implement skill handles only implementation and focused checks. Runtime journeys do not apply because these changes affect instructions only.

Standards review: pending for the new snapshot. Spec review: pending for the same snapshot. Earlier passing results for `35243aa4560541e5b4fab3f843d3c9a2314015b5` do not cover the workflow simplification.

Blast-radius review: pending for the new snapshot. No bulk write or live data operation is part of this change.

Final test result: pending after the new reviews. The earlier `npm test` run passed all 15 tests for `35243aa4560541e5b4fab3f843d3c9a2314015b5`; it does not cover this extension.

PR body update: pending for the simplification. Use Change, Explanation, and Other in Simplified Technical English. Retain the show-me explanation, omit verification results, and link to this ticket. GitHub will apply the default template to new PRs after it reaches the default branch.

PR review disposition: comment `4398148613` is answered and resolved. The original overview diagram is restored. Comment `4398194168` is answered and resolved. Stage 4 and the local-skills section link to `.agents/skills/deslop/SKILL.md`. The global deslop installation entry is removed.

Publication checks: recheck the PR head, CI, review threads, auto-merge, and merge-queue state before push.

Closure: the approved template passed checks and was pushed to PR #13. Both earlier review threads are resolved. This ticket is now OPEN for the workflow simplification. Close it after the new work passes checks and is published.

Next action: complete and review the new workflow and local implement skill. Run the full suite before push. Update PR #13, close the ticket, and push the closure. Merging requires separate authorization.

## Acceptance criteria

- [x] Stage 3 requires relevant type checks and focused tests. It does not require the full test suite.
- [x] Stage 4 requires checks affected by cleanup and applicable runtime checks. It does not require the full test suite.
- [x] The stage text places the final test step after code-review and blast-radius, and before push. The original overview diagram is retained as requested in PR review.
- [x] The final test step requires the full test suite to pass. A failed or blocked run prevents push. Record the command, result, and tested implementation snapshot in the ticket.
- [x] If a test failure needs an implementation change, repeat implementation, cleanup, applicable runtime checks, and both reviews. Then run the full test suite again before push.
- [x] A completed test run remains valid if the implementation does not change. Ticket records and PR text alone do not require another run.
- [x] Installed global skills are unchanged. The project flow owns the final full-suite step.
- [x] Use short sentences and direct instructions for the new text. Follow the requested ASD-STE100 writing style.
- [x] The standard flow closes the ticket after the branch is pushed and the PR is open. It records the PR link and pushes the signed closure commit to the same PR.
- [x] Ticket closure does not wait for PR approval or merge. A failed publication leaves the ticket OPEN. Later CI or review findings that require work reopen the same ticket.
- [x] PR #13 describes both changes in Simplified Technical English. A show-me diagram shows the final test run, publication, ticket closure, and second push.
- [x] The overview diagram matches the original diagram at the fixed review base.
- [x] Stage 4 and the required-skills section link to a standalone project-local deslop skill.
- [x] Both PR review threads are answered and resolved after the fixes are pushed.
- [x] The single default template uses GitHub's supported path, `.github/pull_request_template.md`.
- [x] The template requests the problem, its importance, the resulting behavior, and a ticket link. It has no Verification section.
- [x] Explanation and Other are optional. A diagram is requested only when it helps explain the change. Other covers applicable compatibility, setup, migration, limits, and follow-up work.
- [x] Template guidance requires ASD-STE100 Simplified Technical English, short sentences, and active verbs. Detail is proportional to the change.
- [x] The workflow is the only owner of stage order, test timing, reviews, signed commits, publication, and ticket closure.
- [x] Each stage states its action, required output, pass condition, and failure destination. Existing scope, approval, review, runtime, and publication controls are preserved.
- [x] The local implement skill uses the ticket's listed seams and commands. It runs focused checks after each implemented acceptance criterion and returns to the workflow without reviews, commits, full-suite runs, or publication.
- [x] Setup instructions are in a linked reference. The workflow calls skills instead of repeating their internal checklists. The original overview diagram and all eight decision IDs are preserved.
- [ ] Verification evidence stays in the ticket. The PR body follows the approved template without verification results.
- [x] Required step changes need explicit approval. A completed stage continues automatically. Missing prerequisites and failed checks have explicit failure paths.

Verification for this extension: no application behavior changes and no new behavioral test seam. Check local links, stage fields, decision IDs, skill headers, and exact preservation of the overview diagram. Run the existing full suite, `npm test`, after the reviews. These documentation checks establish structure and references; the reviews assess the workflow's meaning.

## Dependencies

None identified. The related workflow ticket is complete.

## Definition of Done

- [ ] Verify all acceptance criteria and record the evidence.
- [x] Check local Markdown links and run `git diff --check`.
- [ ] Complete Standards, Spec, and blast-radius reviews for this documentation change.
- [ ] Run `npm test` at the final test step. Record any failure or missing prerequisite. Keep this ticket OPEN if a required check is blocked.
