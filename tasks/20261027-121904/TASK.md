# Run tests and ESLint in GitHub Actions

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The repository has a local Node test command and ESLint configuration, but no GitHub Actions workflow. Pull requests currently have no online test or lint result. Add CI checks on the current main branch without changing application behavior. The completed workflow ticket is related, but did not set up CI.

## Prerequisites

Use the committed package lock, Node 24, and the existing test and ESLint configuration. No browser/model download is needed for these checks.

## Acceptance criteria

- [x] A GitHub Actions workflow runs for pull requests targeting main and is configured for pushes to main, on a GitHub-hosted runner.
- [x] A test check installs dependencies from package-lock.json and runs the repository test command. A lint check runs ESLint using a package script; each reports its own result.
- [x] CI skips Puppeteer's browser download because the current tests use fakes; this does not claim runtime browser verification.
- [x] The workflow selects Node 24, matching the available local major version, and uses read-only repository permissions. Test and lint are separate jobs.
- [x] The workflow change stays on a branch and is proposed through a PR. Existing unrelated worktrees and application tickets remain untouched.

## Dependencies

- [Implementation flow](../20261010-214050/TASK.md).
- [Draft application verification](../20261027-104746/TASK.md) remains a separate runtime task.
- [Full-repository ESLint cleanup](../20261027-125302/TASK.md) tracks the existing errors exposed by the new check.

## Definition of Done

- [x] Record local test and lint command results, workflow validation, and first online check results in this ticket.
- [x] Review the implementation against the acceptance criteria and applicable repository standards.
- [x] Publish a PR with a show-me-prepared body; keep the PR open for review.

Implementation state: stage 7, [PR #10](https://github.com/ragemous3/personal-webpage/pull/10) open on feature/ci-tests-lint. Fixed review base: bf479770f675667d331eec2462a1138237d641c5. Mode: autopilot, explicitly approved by the user for scoped tests, ticket updates, signed commits, push, PR creation and CI fixes through handoff. No merge or deployment authorization. Reviewed implementation snapshot: 5b6168b67e4bdce428d97188608a391af15a85fa. The user chose to retain the full failing lint check and track cleanup in ticket 20261027-125302. Next action: hand off the open PR with the passing test result and documented lint debt.

Evidence: The YAML parsed successfully and the main triggers, read permission, both job commands, and dependency-install order were checked. `git diff --check` passed. The first local `npm ci` was interrupted after registry fetching stalled, and the offline retry timed out after two minutes. Neither installation is counted as a pass; the online clean runner results are below. Standards review of 5b6168b: 0 actionable findings. Spec review of the same snapshot: 0 actionable findings. Blast-radius is not applicable: the change configures read-only CI checks, with no bulk or destructive writes to real data. Runtime browser verification is not applicable to this CI configuration change.

First online run: [CI run 40506988860](https://github.com/ragemous3/personal-webpage/actions/runs/40506988860) on PR #10. Both `npm ci` steps succeeded. The `test` job passed: 15 tests, 0 failures. The `lint` job ran `npm run lint` and failed with 188 ESLint errors in files not changed by this PR. The report includes the existing application, index scripts, verification helpers and workflow decision CLI. The initial clean run proves the CI configuration executes, but the repository-wide lint result is not green.

Disposition: keep `eslint .` as a full, failing check rather than reducing coverage. [Ticket 20261027-125302](../20261027-125302/TASK.md) owns the existing lint cleanup. PR #10 remains open for review; merging is not authorized here.
