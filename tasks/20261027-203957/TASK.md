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

## Prerequisites

The user approved the requirements and the documentation changes in this conversation. Use Guided mode. The user explicitly authorized pushing the task branch and opening a PR. Merging is not authorized.

Branch: `feature/final-test-step`. Fixed review base: `bf479770f675667d331eec2462a1138237d641c5`. A fetch of `origin/main` confirmed this base.

Current stage: implement the requested PR review fixes on [PR #13](https://github.com/ragemous3/personal-webpage/pull/13). Previous signed implementation snapshot: `30dd06b39358f2caa6d02b03636bd3aa11508e30`. Both previous review results are invalid for this fix pass. SSH commit signing is configured. Local signature verification passed. GitHub recognition of the signature has not been verified.

Checks: all eight local Markdown links passed. `git diff --check` passed. Application runtime checks do not apply because only workflow documentation and this ticket changed.

Standards review: zero actionable findings for signed snapshot `30dd06b39358f2caa6d02b03636bd3aa11508e30`. Spec review: zero actionable findings for the same snapshot. Both reviewers compared it with the fixed base. The Spec review found a diagram connector that could skip the final test step. The sequential diagram fixed that issue, and the repeat review confirmed the fix.

Blast-radius review: not applicable for signed snapshot `30dd06b39358f2caa6d02b03636bd3aa11508e30`. The changes affect workflow documentation and this ticket. They do not add bulk writes, deletion, or operations on live data.

Final test result: `npm test` exited 0 in the managed environment after both reviews. All 15 tests passed. No tests failed, were cancelled, or were skipped. Tested implementation snapshot: `30dd06b39358f2caa6d02b03636bd3aa11508e30`. Only ticket records changed after this run, so the passing result remains valid.

The published PR body matches the prepared text. It describes both approved changes in Simplified Technical English. Its show-me diagram shows reviews, final tests, push, PR publication, ticket closure, and the second push. It records validation for implementation snapshot `30dd06b39358f2caa6d02b03636bd3aa11508e30`.

Publication checks: the PR is OPEN, not a draft, and MERGEABLE. GitHub reports no CI checks and no required check contexts. There are no unresolved review threads. Auto-merge is disabled and the PR is not in a merge queue.

Closure: this ticket was closed after publication. It is now OPEN because PR review requires more work. Close it again after the fixes pass checks and are pushed to the same PR.

Next action: review the signed fixes, run the final test suite, and push to PR #13. Reply to and resolve both review threads. Then close this ticket and push its closure. Merging requires separate authorization.

## Acceptance criteria

- [x] Stage 3 requires relevant type checks and focused tests. It does not require the full test suite.
- [x] Stage 4 requires checks affected by cleanup and applicable runtime checks. It does not require the full test suite.
- [x] The stage text places the final test step after code-review and blast-radius, and before push. The original overview diagram is retained as requested in PR review.
- [x] The final test step requires the full test suite to pass. A failed or blocked run prevents push. Record the command, result, and tested implementation snapshot in the ticket.
- [x] If a test failure needs an implementation change, repeat implementation, cleanup, applicable runtime checks, and both reviews. Then run the full test suite again before push.
- [x] A completed test run remains valid if the implementation does not change. Ticket records and PR text alone do not require another run.
- [x] The installed implement skill is unchanged. The project flow states that its final test step satisfies the skill's full test requirement.
- [x] Use short sentences and direct instructions for the new text. Follow the requested ASD-STE100 writing style.
- [x] The standard flow closes the ticket after the branch is pushed and the PR is open. It records the PR link and pushes the signed closure commit to the same PR.
- [x] Ticket closure does not wait for PR approval or merge. A failed publication leaves the ticket OPEN. Later CI or review findings that require work reopen the same ticket.
- [x] PR #13 describes both changes in Simplified Technical English. A show-me diagram shows the final test run, publication, ticket closure, and second push.
- [ ] The overview diagram matches the original diagram at the fixed review base.
- [ ] Stage 4 and the required-skills table link to a standalone project-local deslop skill.
- [ ] Both PR review threads are answered and resolved after the fixes are pushed.

## Dependencies

None identified. The related workflow ticket is complete.

## Definition of Done

- [ ] Verify all acceptance criteria and record the evidence.
- [ ] Check local Markdown links and run `git diff --check`.
- [ ] Complete Standards, Spec, and blast-radius reviews for this documentation change.
- [ ] Run `npm test` at the final test step. Record any failure or missing prerequisite. Keep this ticket OPEN if a required check is blocked.
