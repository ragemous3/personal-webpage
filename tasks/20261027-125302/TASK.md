# Resolve existing full-repository ESLint failures

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The first full-repository ESLint check in [CI PR #10](https://github.com/ragemous3/personal-webpage/pull/10) found 188 errors across existing application code, index scripts, verification helpers and workflow tooling. No JavaScript or TypeScript source files changed in that CI PR. Keep the full lint check visible and resolve this existing debt separately.

## Prerequisites

Use the existing ESLint configuration and committed dependency lock. Review errors by file and rule before editing; preserve application and helper behavior. Avoid broad rule suppression to make the check green.

## Acceptance criteria

- [ ] The full `npm run lint` command exits 0 on a clean dependency install, with the same file coverage and effective rules as CI PR #10.
- [ ] Existing application, index generation, verification helper, and workflow CLI behavior remains intact; add or update meaningful regression coverage where a lint fix changes behavior.
- [ ] The cleanup is reviewed against the original errors and implemented in manageable signed snapshots. Do not hide errors through blanket ignores or a non-failing CI step.

## Dependencies

- [Add online test and lint checks](../20261027-121904/TASK.md).
- CI PR #10 establishes the full lint check and supplies the initial 188-error baseline.

## Definition of Done

- [ ] Record the original and final full ESLint command results and relevant test results.
- [ ] Complete Standards and Spec review and an applicable blast-radius disposition.
- [ ] Publish a PR with the original CI lint check passing; merge only with separate authorization.

Implementation state: backlog. Initial evidence: [CI run 40506988860](https://github.com/ragemous3/personal-webpage/actions/runs/40506988860) completed the test job with 15 passing tests and failed `npm run lint` with 188 existing ESLint errors. No cleanup is included in the CI setup PR.
