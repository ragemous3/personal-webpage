# Run tests and ESLint in GitHub Actions

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The repository has a local Node test command and ESLint configuration, but no GitHub Actions workflow. Pull requests currently have no online test or lint result. Add CI checks on the current main branch without changing application behavior. The completed workflow ticket is related, but did not set up CI.

## Prerequisites

Use the committed package lock, Node 24, and the existing test and ESLint configuration. No browser/model download is needed for these checks.

## Acceptance criteria

- [x] A GitHub Actions workflow is configured for pull requests targeting main and pushes to main, on a GitHub-hosted runner. First live run is pending.
- [x] A test check installs dependencies from package-lock.json and runs the repository test command. A lint check runs ESLint using a package script; both fail when their command fails. First live run is pending.
- [x] CI skips Puppeteer's browser download because the current tests use fakes; this does not claim runtime browser verification.
- [x] The workflow selects Node 24, matching the available local major version, and uses read-only repository permissions. Test and lint are separate jobs. First live run is pending.
- [ ] The workflow change stays on a branch and is proposed through a PR. Existing unrelated worktrees and application tickets remain untouched.

## Dependencies

- [Implementation flow](../20261010-214050/TASK.md).
- [Draft application verification](../20261027-104746/TASK.md) remains a separate runtime task.

## Definition of Done

- [ ] Record local test and lint command results, workflow validation, and first online check results in this ticket.
- [x] Review the implementation against the acceptance criteria and applicable repository standards.
- [ ] Publish a PR with a show-me-prepared body; keep the PR open for review.

Implementation state: stage 7, branch feature/ci-tests-lint in /tmp/personal-webpage-ci-tests-lint. Fixed review base: bf479770f675667d331eec2462a1138237d641c5. Mode: autopilot, explicitly approved by the user for scoped tests, ticket updates, signed commits, push, PR creation and CI fixes through handoff. No merge or deployment authorization. Reviewed implementation snapshot: 5b6168b67e4bdce428d97188608a391af15a85fa. Next action: publish the PR, inspect both online checks, and resolve findings within scope.

Evidence: The YAML parsed successfully and the main triggers, read permission, both job commands, and dependency-install order were checked. `git diff --check` passed. The first local `npm ci` was interrupted after registry fetching stalled, and the offline retry timed out after two minutes. Neither installation is counted as a pass; the PR's clean runner is the pending verification. Standards review of 5b6168b: 0 actionable findings. Spec review of the same snapshot: 0 actionable findings. Blast-radius is not applicable: the change configures read-only CI checks, with no bulk or destructive writes to real data. Runtime browser verification is not applicable to this CI configuration change.
