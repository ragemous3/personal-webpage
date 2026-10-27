# Fix all lint errors and warnings

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The full ESLint check reports 188 errors and no warnings at commit `bf47977` on 2026-10-27.
Of these errors, ESLint can potentially correct 51 with `--fix`.
A clean result will help developers identify new code defects.

Command used from the repository root:

```sh
node node_modules/eslint/bin/eslint.js . --max-warnings 0
```

The command returned exit code 1.
Errors affect `assets/`, `scripts/`, `tests/`, and JavaScript helpers under `.agents/skills/`.
They include unresolved imports, unsafe types, unused declarations, import order, and function complexity.
The rules and file selection are in [eslint.config.js](../../eslint.config.js).
The [README lint instructions](../../README.md#linting) use the same repository scope.

## Prerequisites

- Install the dependencies specified by `package-lock.json` with `npm ci`.
- Run the command above before changes. Record the current errors because the baseline can change.
- Check the related worker and chat tickets before changing shared code.

## Acceptance criteria

- [ ] The command above checks the full repository and returns exit code 0, with no errors or warnings.
- [ ] All JavaScript and TypeScript files in the current ESLint scope remain in scope, including tests and skill helpers.
- [ ] Fix the code without disabling rules, reducing rule severity, adding suppressions, or excluding files to hide errors.
- [ ] Correct configuration only when it does not represent the actual build or execution environment. Record evidence for each correction.
- [ ] Preserve application behavior, worker messages, public interfaces, and tool output. Test any necessary behavior correction at its affected interface.

## Dependencies

No required ticket order is established.
Coordinate changes to shared files with these open tickets:

- [Language-model worker initialization](../20261011-184042/TASK.md).
- [Shared chat response and cancellation](../20261022-202009/TASK.md).

These tickets cover related product defects. They do not replace the full lint check.

## Definition of Done

- [ ] Verify all acceptance criteria. Record the final command, exit code, error counts, and source commit.
- [ ] Run `npm test`, the TypeScript check, and the Hugo build. Record results and any existing unrelated failures.
- [ ] Verify affected application journeys when changes affect behavior. Record evidence or the exact blocker.
- [ ] Complete the applicable checks and reviews in the [implementation flow](../../docs/implementation-flow.md) before closure.
- [ ] Run `git diff --check` and review automatic fixes for unintended changes.

### Implementation state

Execution mode: Autopilot. On 2026-10-27, the user said: "Start implementation autopilot".
Scope: implement this ticket, run applicable tests, clean up code, correct review findings, and update related comments and ticket records.
The mode also covers signed commits, pushing the task branch, opening its PR, and handling CI and review findings.
Finish with an open, unmerged PR. Merging, auto-merge, deployment, and live destructive operations require separate approval.

Branch: `feature/20261027-204257-lint-cleanup`.
Fixed review base: `2de83ca38763c9c21ba805eca71c8cea236b73ec`.
Current stage: cleanup and verification. Latest implementation snapshot: `b17b6d8405885d3012ab7b983ba4cb41e8b9852d` (pushed).
Standards review: pending. Spec review: pending. Blast-radius review: pending.
Verification uses the full ESLint command and the existing test interfaces. These check rule compliance and covered behavior; they do not prove real model execution.
Next action: refresh the baseline on current main, then correct lint errors without reducing checks.

### Implementation notes

The refreshed baseline at the fixed review base has 173 errors and no warnings.
Automatic fixes removed 52 errors. Manual changes correct imports, split complex checks, and use event listeners.
Four unused empty placeholder files were removed. Repository searches found no imports of these files.
No rule was disabled. No severity was reduced. No suppression or ignore pattern was added.
The configuration now identifies `@params/config` as a Hugo virtual module and supplies browser globals for the browser index generator.
The context provider omits the optional initial value when dependency construction returns undefined. The context value stays unchanged.

`npm ci` initially failed because a dependency download bypassed the proxy.
`NODE_USE_ENV_PROXY=1 npm ci --cache /tmp/lint-work-npm-cache` completed successfully with 373 packages.
The full lint command passes with no errors or warnings. The existing 24 tests pass with subprocess permissions.
An initial test run inside the restricted sandbox failed because nested Node processes reported `EPERM`.
Hugo 0.152.2 and PostCSS CLI were installed under `/tmp` for verification. The site build passes with two existing layout warnings.
Real answer verification is blocked by missing résumé index files and the existing response lifecycle work.
Commit signing is also blocked: this machine has no configured signing key or local GPG/SSH key directory.
The user created a separate SSH signing key and asked to push the branch. The signing preflight passed. The key is configured globally for Git signing.
Branch push: `feature/20261027-204257-lint-cleanup` at `b17b6d8405885d3012ab7b983ba4cb41e8b9852d`. Both implementation commits carry SSH signatures. `git diff origin/main...HEAD --check` passed.

Next action: resolve the live-verification blocker. The requested alternative has not been approved. Formal Standards and Spec reviews and PR creation remain pending.

### Verification evidence

- [Full lint result](evidence/lint-summary.json): exit 0, 97 files checked, no errors or warnings.
- Effective ESLint rule comparison against the review base passed for application, browser script, Node script, test, and skill-helper files. Only absolute project paths were normalized.
- [Full test suite](evidence/tests.log): `npm test` exited 0; 29 tests passed, none failed.
- New checks cover message validation, custom task guards, the existing vector-response export, progress boundaries, and event delivery without duplicate notifications.
- Token chunk output and partial-result recovery passed a separate public-method check with fixed token values and no model download.
- [Type check](evidence/types.log): exit 2, six existing errors. Three affect tracked application code; three affect ignored `public/` artifacts.
- [Tracked baseline type check](evidence/types-base.log): 12 errors. Nine were resolved; none were added. Existing ignored public artifacts account for the other three current errors.
- [Hugo build](evidence/hugo-build.log): exit 0 using Hugo 0.152.2 and temporary PostCSS CLI; existing taxonomy and term layout warnings remain.
- [Runtime prerequisite report](evidence/doctor.json): BLOCKED. The package entry for `hnswlib-wasm` does not resolve, and the three résumé index files are absent.
- Live browser journeys were not run. The user has been asked to accept the passing tests, build, and reviews as the alternative for this lint ticket.
- `observe.js --help` and `git diff --check` passed. Automatic fixes and the working diff were inspected for unintended changes.
- The index download helper was not executed because it removes the destination data directory. Its file operations are unchanged.

The ticket remains OPEN. The signed snapshot is ready for push. The ticket remains OPEN pending formal reviews and resolution of the live-verification blocker.
