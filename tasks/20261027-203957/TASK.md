# Run the full test suite before push

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The implementation flow requires the full test suite during implementation and after cleanup. These instructions cause repeated test runs. The user approved one final run after the reviews and before push.

Change [the implementation flow](../../docs/implementation-flow.md). Remove the early instructions to run the full test suite. Keep focused tests during implementation and cleanup. Add one final test step before push.

Related work: [Connect design interviews to the TATR implementation flow](../20261010-214050/TASK.md). That ticket is CLOSED.

Scope extension approved by the user: make ticket closure a standard part of PR publication. After the branch is pushed and the PR is open, close the ticket. Record the PR link, commit the closure, and push it to the same PR. Do not wait for PR approval or merge. Reopen the same ticket if CI or review requires more work. Update this PR in Simplified Technical English and use show-me to explain the sequence.

## Prerequisites

The user approved the requirements and the documentation changes in this conversation. Use Guided mode. The user explicitly authorized pushing the task branch and opening a PR. Merging is not authorized.

Branch: `feature/final-test-step`. Fixed review base: `bf479770f675667d331eec2462a1138237d641c5`. A fetch of `origin/main` confirmed this base.

Current stage: implement the approved scope extension on [PR #13](https://github.com/ragemous3/personal-webpage/pull/13). Earlier signed implementation snapshot: `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`. The new snapshot is pending. The initial GPG signing attempt failed. The user then authorized a new SSH signing key for this environment. Git now uses SSH signing. The signing preflight and `git verify-commit` passed. GitHub rejected automatic public-key registration with HTTP 403, `Resource not accessible by integration`. GitHub recognition of the signature has not been verified. The user explicitly requested publication after this result was reported.

Checks: the five decision CLI tests passed in the managed environment. The default sandbox denied child-process creation with `EPERM`. Eight local Markdown links passed. `git diff --cached --check` passed. Application runtime checks do not apply because only workflow documentation and this ticket changed.

Earlier Standards and Spec reviews found zero actionable findings for signed snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`. Both results are invalid for the scope extension. Repeat both reviews for the new signed snapshot. The earlier staged-change finding about missing ticket records is resolved.

Blast-radius review: not applicable for signed snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`. The changes affect workflow documentation and this ticket. They do not add bulk writes, deletion, or operations on live data.

Final test result: `npm test` exited 0 in the managed environment. All 15 tests passed. No tests failed, were cancelled, or were skipped. The tested changes were staged on base `bf479770f675667d331eec2462a1138237d641c5`. The result covers implementation snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`: only ticket records changed after the run. The workflow and executable files are unchanged, so the passing result remains valid.

The published PR body matches the prepared text. It includes the stage order and validation results for implementation snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`. Later commits update only ticket records.

Publication checks: the PR is OPEN, not a draft, and MERGEABLE. GitHub reports no CI checks and no required check contexts. There are no unresolved review threads. Auto-merge is disabled and the PR is not in a merge queue.

Next action: complete the scope extension, review the signed snapshot, and run the full test suite. Push the changes to PR #13. Then close this ticket, commit the closure, and push it to the same PR. Merging requires separate authorization.

## Acceptance criteria

- [x] Stage 3 requires relevant type checks and focused tests. It does not require the full test suite.
- [x] Stage 4 requires checks affected by cleanup and applicable runtime checks. It does not require the full test suite.
- [x] The flow diagram and stage text place the final test step after code-review and blast-radius, and before push.
- [x] The final test step requires the full test suite to pass. A failed or blocked run prevents push. Record the command, result, and tested implementation snapshot in the ticket.
- [x] If a test failure needs an implementation change, repeat implementation, cleanup, applicable runtime checks, and both reviews. Then run the full test suite again before push.
- [x] A completed test run remains valid if the implementation does not change. Ticket records and PR text alone do not require another run.
- [x] The installed implement skill is unchanged. The project flow states that its final test step satisfies the skill's full test requirement.
- [x] Use short sentences and direct instructions for the new text. Follow the requested ASD-STE100 writing style.
- [ ] The standard flow closes the ticket after the branch is pushed and the PR is open. It records the PR link and pushes the signed closure commit to the same PR.
- [ ] Ticket closure does not wait for PR approval or merge. A failed publication leaves the ticket OPEN. Later CI or review findings that require work reopen the same ticket.
- [ ] PR #13 describes both changes in Simplified Technical English. A show-me diagram shows the final test run, publication, ticket closure, and second push.

## Dependencies

None identified. The related workflow ticket is complete.

## Definition of Done

- [ ] Verify all acceptance criteria and record the evidence.
- [ ] Check local Markdown links and run `git diff --check`.
- [ ] Complete Standards, Spec, and blast-radius reviews for this documentation change.
- [ ] Run `npm test` at the final test step. Record any failure or missing prerequisite. Keep this ticket OPEN if a required check is blocked.
