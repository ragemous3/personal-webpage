# Run the full test suite before push

- STATUS: CLOSED
- PRIORITY: 100
- TAGS: task

## Background

The implementation flow requires the full test suite during implementation and after cleanup. These instructions cause repeated test runs. The user approved one final run after the reviews and before push.

Change [the implementation flow](../../docs/implementation-flow.md). Remove the early instructions to run the full test suite. Keep focused tests during implementation and cleanup. Add one final test step before push.

Related work: [Connect design interviews to the TATR implementation flow](../20261010-214050/TASK.md). That ticket is CLOSED.

Scope extension approved by the user: make ticket closure a standard part of PR publication. After the branch is pushed and the PR is open, close the ticket. Record the PR link, commit the closure, and push it to the same PR. Do not wait for PR approval or merge. Reopen the same ticket if CI or review requires more work. Update this PR in Simplified Technical English and use show-me to explain the sequence.

PR review fixes requested by the user: restore the original overview diagram. Keep the test timing instructions in the stage text. Use a local deslop skill instead of the external link. The existing show-me stage stays in place.

PR template extension approved by the user: add a default GitHub PR description template. Use Change, Explanation, and Other as section names. Explain the problem, why it matters, and the resulting behavior. Make Explanation and Other optional. Use show-me when a diagram or example helps. Require ASD-STE100 Simplified Technical English, short sentences, and active verbs. Omit verification from the PR body; retain check evidence in this ticket. Link to the ticket for background and acceptance criteria. The optional Theo reference has not been identified, so this template does not claim to use it.

## Prerequisites

The user approved the requirements and the documentation changes in this conversation. Use Guided mode. The user explicitly authorized pushing the task branch and opening a PR. Merging is not authorized.

Branch: `feature/final-test-step`. Fixed review base: `bf479770f675667d331eec2462a1138237d641c5`. A fetch of `origin/main` confirmed this base.

Current stage: complete; the approved PR template is published in [PR #13](https://github.com/ragemous3/personal-webpage/pull/13). Latest signed implementation snapshot: `35243aa4560541e5b4fab3f843d3c9a2314015b5`. SSH commit signing is configured. Local signature verification passed. GitHub recognition of the signature has not been verified.

Checks: the approved template sections and ASD-STE100 instruction passed validation. All 10 local Markdown links and `git diff --check` passed. The earlier checks confirmed the original overview diagram and local deslop header. Application runtime checks do not apply because only documentation, the PR template, and a local cleanup skill changed.

Standards review: zero actionable findings for signed snapshot `35243aa4560541e5b4fab3f843d3c9a2314015b5`. Spec review: zero actionable findings for the same snapshot. Both reviewers confirmed the approved template wording, optional sections, and absence of a Verification section. The user's instruction to omit verification from the PR body takes precedence over the earlier workflow wording. Check evidence remains in this ticket.

Blast-radius review: not applicable for signed snapshot `35243aa4560541e5b4fab3f843d3c9a2314015b5`. The changes affect documentation, the PR template, and a local cleanup skill. They do not add bulk writes, deletion, or operations on live data.

Final test result: `npm test` exited 0 in the managed environment after both reviews. All 15 tests passed. No tests failed, were cancelled, or were skipped. Tested implementation snapshot: `35243aa4560541e5b4fab3f843d3c9a2314015b5`. Only ticket records changed after this run, so the passing result remains valid.

The published PR body matches the prepared text and follows the approved template. It uses Change, Explanation, and Other. It describes the full change in Simplified Technical English and includes the show-me diagram. It omits verification results and links to this ticket. GitHub will apply the default template to new PRs after it reaches the default branch.

PR review disposition: comment `4398148613` is answered and resolved. The original overview diagram is restored. Comment `4398194168` is answered and resolved. Stage 4 and the local-skills section link to `.agents/skills/deslop/SKILL.md`. The global deslop installation entry is removed.

Publication checks: the PR is OPEN, not a draft, and MERGEABLE. GitHub reports no CI checks and no required check contexts. There are no unresolved review threads. Auto-merge is disabled and the PR is not in a merge queue.

Closure: the approved template passed checks and was pushed to PR #13. Both earlier review threads are resolved. This ticket is CLOSED again. Commit and push this closure to the same PR branch.

Next action: review the open PR. The user's next request is a review of the implement skill, without edits to that skill. Merging requires separate authorization.

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
- [x] The overview diagram matches the original diagram at the fixed review base.
- [x] Stage 4 and the required-skills section link to a standalone project-local deslop skill.
- [x] Both PR review threads are answered and resolved after the fixes are pushed.
- [x] The single default template uses GitHub's supported path, `.github/pull_request_template.md`.
- [x] The template requests the problem, its importance, the resulting behavior, and a ticket link. It has no Verification section.
- [x] Explanation and Other are optional. A diagram is requested only when it helps explain the change. Other covers applicable compatibility, setup, migration, limits, and follow-up work.
- [x] Template guidance requires ASD-STE100 Simplified Technical English, short sentences, and active verbs. Detail is proportional to the change.

## Dependencies

None identified. The related workflow ticket is complete.

## Definition of Done

- [x] Verify all acceptance criteria and record the evidence.
- [x] Check local Markdown links and run `git diff --check`.
- [x] Complete Standards, Spec, and blast-radius reviews for this documentation change.
- [x] Run `npm test` at the final test step. Record any failure or missing prerequisite. Keep this ticket OPEN if a required check is blocked.
