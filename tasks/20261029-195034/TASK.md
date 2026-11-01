# Make the production build reproducible and check it in CI

- STATUS: OPEN
- PRIORITY: 500
- TAGS: task, verification

## Background

Provide a reproducible production build and check it in CI. The user accepted this support-task recommendation on 2026-10-29 and requested prioritization on 2026-11-01. Schedule this first (priority 500), then [application verification](../20261027-104746/TASK.md) (400), the [combined RuntimeCoordinator refactor](../20261029-193942/TASK.md) (300), and configuration (100). Establish reliable build checks before changing the worker topology.

At planning base `9cbe959120ab72d56e212ea27f9405992a4d6f58`, `npm run build` points to `eslint-project-specifc.config.js` rather than a Hugo production-build command. [CI](../../.github/workflows/ci.yml) runs tests and lint without building the site. Earlier verification required a compatible Hugo version; the older installed version did not understand the template layout. Development-browser success alone does not prove production worker URLs and generated assets are valid.

The [worker-build partial](../../layouts/_partials/build-js/configs/common/build-workers.html) fingerprints production worker assets. The application receives their paths through generated configuration. Removing a worker or changing its entry point needs a check of that output, not just a passing TypeScript unit test.

The earlier planning branch was `docs/20261029-worker-refactor-tatrs`. Implementation has not started. This task concerns build verification, not deployment or a release.

**What to build:** one reproducible production-site build that developers and CI run with the same toolchain, with checks that catch broken worker assets.

**Demo path:** build a clean checkout, inspect the generated worker assets, and run an isolated negative check with a missing worker reference. The normal build succeeds and the negative check fails locally and in CI.

### Migration contract for the later runtime refactor

When the runtime refactor lands, its build checks must cover the RuntimeCoordinator, generation and retrieval SharedWorker assets, including fingerprints, module references and deployment base paths. It must remove obsolete dedicated-hub and ownership-state worker entries from clean output. This ticket establishes the reusable checks against today's topology; the runtime ticket owns changing the expected topology and proving the new assets.

Planning publication: branch `docs/20261101-runtime-tickets-skills`, fixed base `1f2efdd54c68a7f94726e5aee6d8db2e064baab9`. The user authorized ticket refinement, repository skill installation, signed commits, branch push and PR creation. This publishes the plan only; this implementation ticket stays OPEN.

## Prerequisites

- Record the supported Hugo/Node versions, dependency-install commands and site base-path configuration. Choose a reproducible way for local users and CI to obtain the same toolchain.
- Inventory whether production building needs generated retrieval data. Keep browser-generated index data ignored; do not introduce model downloads or inference as an accidental build requirement.
- Establish which source/build assertions verify worker entry points and URLs, and what requires a separate runtime journey.

## Acceptance criteria

- [ ] `npm run build` performs the documented production site build from a clean checkout using supported, reproducible tool versions and locked npm dependencies.
- [ ] CI runs the same build and fails when it fails. A controlled missing worker entry or broken build configuration is detected by the agreed isolated check.
- [ ] Verify the generated worker map and referenced worker assets, including production fingerprints and the supported deployment base path. Removed workers do not leave required entries or broken references.
- [ ] Run the asset checks against the current worker topology. Isolated missing-entry, stale-reference and incorrect-base-path cases fail for the expected reason. Record the migration contract above without requiring future worker assets to exist.
- [ ] Build inputs and outputs are explicit. Fresh and repeated builds do not depend on stale ignored `public/` assets; generated output, model caches and retrieval indices are not committed.
- [ ] Report warnings and environmental limitations accurately. Distinguish a successful site build and asset validation from successful model loading or answers in a browser.

## Dependencies

**Blocked by:** None. This is the first scheduled ticket.

- [CI setup](../20261027-121904/TASK.md) supplies the existing workflow.
- Coordinate toolchain and generated-source handling with the [TypeScript-check task](../20261029-195033/TASK.md), and runtime evidence with [application verification](../20261027-104746/TASK.md).

## Definition of Done

- [ ] All acceptance criteria have recorded commands, tool versions, source revision and output evidence.
- [ ] Complete applicable repository checks, cleanup, reviews and the final full suite in the implementation flow. Report available CI results without waiting for CI unless requested.
- [ ] Document the reproducible local/CI build. No deployment, release or model-quality claim is part of completion.

Next action: inspect build inputs and choose the supported toolchain and production-asset checks before implementation.
