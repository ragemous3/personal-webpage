# Make TypeScript checking pass and add it to CI

- STATUS: OPEN
- PRIORITY: 90
- TAGS: task, verification

## Background

Make TypeScript checking a reliable local and CI verification step. The user accepted this support-task recommendation on 2026-10-29. The primary sequence remains hub removal, state-machine/Web Locks refactoring, then configuration; this supporting backlog task has priority 90 and does not change that order.

At planning base `9cbe959120ab72d56e212ea27f9405992a4d6f58`, [CI](../../.github/workflows/ci.yml) runs tests and ESLint but no TypeScript check. The [test loader](../../scripts/typescript-test.loader.js) uses `transpileModule`, which does not establish project-wide type correctness. The strict [TypeScript configuration](../../tsconfig.json) therefore does not currently provide a passing automated gate for interface changes.

The configuration branch recorded five baseline diagnostics involving undefined `RagStates`, an excessively complex embedding expression and imports under generated `public/` output. The undefined type is also visible in the planning base's `assets/layers/data/models/models.ts`. Reproduce the exact diagnostic set with the locked toolchain on the implementation base; the historical count is not a fresh type-check result. The earlier [parsing fix](../20261011-184040/TASK.md) was deliberately narrower and should remain closed.

Planning branch: `docs/20261029-worker-refactor-tatrs`. Implementation has not started.

## Prerequisites

- Install dependencies from the committed lockfile in the worktree being checked. Capture the compiler version, full command, source revision and diagnostics before editing.
- Determine how Hugo-provided modules and generated output should be represented or excluded without dropping application sources from checking. Coordinate with the production-build ticket's toolchain choices.
- Classify each diagnostic as a real source error, generated-input boundary or dependency typing issue; keep unrelated application behavior outside this change.

## Acceptance criteria

- [ ] A documented `npm run typecheck` command uses the project-locked compiler and exits zero on the intended application sources from a clean checkout.
- [ ] Resolve the reproduced diagnostics without disabling strictness, blanket `any` casts, broad suppression or excluding problematic application files merely to pass.
- [ ] The source selection handles generated Hugo output and external build-time modules deliberately. Checking a clean checkout and a checkout after a production build gives consistent results.
- [ ] CI runs the same type-check command for pull requests and main updates, alongside the existing tests and lint. A controlled type error in an isolated fixture demonstrates that the check fails.
- [ ] Preserve runtime behavior; where a source fix changes behavior, add focused regression evidence and follow the relevant runtime verification requirements.

## Dependencies

- [CI setup](../20261027-121904/TASK.md) and [TypeScript parsing fix](../20261011-184040/TASK.md) provide existing infrastructure and history.
- Coordinate generated-source handling with the [reproducible production-build task](../20261029-195034/TASK.md). Neither task should silently expand the other's scope.

## Definition of Done

- [ ] All acceptance criteria have evidence recorded against the implementation revision, including before/after diagnostics and source coverage.
- [ ] Complete applicable repository checks, cleanup, reviews and the final full suite in the implementation flow. Confirm the CI definition invokes the locally verified command; report available CI results without waiting for CI unless requested.
- [ ] Document the local command and any required build-time declarations. Keep unrelated type cleanup or dependency upgrades in separate work if needed.

Next action: reproduce and classify the diagnostics on the implementation base, then agree the smallest fixes and source-selection rules.

## Implementation evidence

Mode: autopilot, explicitly approved on 2026-10-29 for scoped implementation, tests, documentation and ticket updates, signed commits, push, PR creation and CI/review fixes through handoff. Branch: `fix/20261029-195033-typescript-ci`. Fixed review base: `2a5aaaf0f9db1e9ab89d617268149edf1d087067`.

Locked TypeScript 5.9.3 reproduced five baseline diagnostics. Removed unused RAGStatus with its undefined RagStates reference. Explicit pipeline task generic arguments resolve dependency union complexity without casts or runtime changes. Generated output directories are excluded while application source remains included. Existing Hugo module declarations remain unchanged.

`npm run typecheck`: passes before and after Hugo 0.158.0 production build. An isolated application fixture assigning a number to string produces TS2322 and a nonzero exit; fixture removed afterward. `npm test`: 42 passed, zero failures. `npm run lint` and whitespace checks pass. Hugo production build passes with existing missing taxonomy/term template warnings. Runtime journeys and blast-radius checks are inapplicable: only type annotations, an unused interface, compiler source selection and CI change; no runtime behavior or data operations change.

Stage: review and final verification. Next action: finish review, publish the scoped PR and record closure.
