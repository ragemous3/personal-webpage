# Run the full test suite before push

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The implementation flow requires the full test suite during implementation and after cleanup. These instructions cause repeated test runs. The user approved one final run after the reviews and before push.

Change [the implementation flow](../../docs/implementation-flow.md). Remove the early instructions to run the full test suite. Keep focused tests during implementation and cleanup. Add one final test step before push.

Related work: [Connect design interviews to the TATR implementation flow](../20261010-214050/TASK.md). That ticket is CLOSED. This ticket changes only the time of the full test run.

## Prerequisites

The user approved the requirements and the documentation changes in this conversation. Use Guided mode. Publication is not authorized.

Branch: `feature/final-test-step`. Fixed review base: `bf479770f675667d331eec2462a1138237d641c5`. A fetch of `origin/main` confirmed this base.

Current stage: before publication; GitHub signing-key registration pending. Latest signed implementation snapshot: `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`. The initial GPG signing attempt failed. The user then authorized a new SSH signing key for this environment. Git now uses SSH signing. The signing preflight and `git verify-commit` passed. GitHub rejected automatic public-key registration with HTTP 403, `Resource not accessible by integration`. Registration in the user's GitHub settings remains pending.

Checks: the five decision CLI tests passed in the managed environment. The default sandbox denied child-process creation with `EPERM`. Eight local Markdown links passed. `git diff --cached --check` passed. Application runtime checks do not apply because only workflow documentation and this ticket changed.

Standards review: zero actionable findings for signed snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`. Spec review: zero actionable findings for the same snapshot. Both reviewers compared it with the fixed base. The earlier staged-change finding about missing ticket records is resolved.

Blast-radius review: not applicable for signed snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`. The changes affect workflow documentation and this ticket. They do not add bulk writes, deletion, or operations on live data.

Final test result: `npm test` exited 0 in the managed environment. All 15 tests passed. No tests failed, were cancelled, or were skipped. The tested changes were staged on base `bf479770f675667d331eec2462a1138237d641c5`. The result covers implementation snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`: only ticket records changed after the run. The workflow and executable files are unchanged, so the passing result remains valid.

The PR body is prepared locally with the stage order and validation results. It describes implementation snapshot `91ffa1cfc7e39f2383c8c9c4bb65c2d38e10cb70`.

Next action: add the public key as a Signing key in GitHub settings. Confirm publication is authorized before push. Keep this ticket OPEN until publication is complete.

## Acceptance criteria

- [x] Stage 3 requires relevant type checks and focused tests. It does not require the full test suite.
- [x] Stage 4 requires checks affected by cleanup and applicable runtime checks. It does not require the full test suite.
- [x] The flow diagram and stage text place the final test step after code-review and blast-radius, and before push.
- [x] The final test step requires the full test suite to pass. A failed or blocked run prevents push. Record the command, result, and tested implementation snapshot in the ticket.
- [x] If a test failure needs an implementation change, repeat implementation, cleanup, applicable runtime checks, and both reviews. Then run the full test suite again before push.
- [x] A completed test run remains valid if the implementation does not change. Ticket records and PR text alone do not require another run.
- [x] The installed implement skill is unchanged. The project flow states that its final test step satisfies the skill's full test requirement.
- [x] Use short sentences and direct instructions for the new text. Follow the requested ASD-STE100 writing style.

## Dependencies

None identified. The related workflow ticket is complete.

## Definition of Done

- [x] Verify all acceptance criteria and record the evidence.
- [x] Check local Markdown links and run `git diff --check`.
- [x] Complete Standards, Spec, and blast-radius reviews for this documentation change.
- [x] Run `npm test` at the final test step. Record any failure or missing prerequisite. Keep this ticket OPEN if a required check is blocked.
