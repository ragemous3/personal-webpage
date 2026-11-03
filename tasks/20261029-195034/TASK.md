# Make the production build reproducible and check it in CI

- STATUS: CLOSED
- PRIORITY: 500
- TAGS: task, verification

## Background

Provide a reproducible production build and check it in CI. The user accepted this support-task recommendation on 2026-10-29 and requested prioritization on 2026-11-01. Schedule this first (priority 500), then [application verification](../20261027-104746/TASK.md) (400), the [combined RuntimeCoordinator refactor](../20261029-193942/TASK.md) (300), and configuration (100). Establish reliable build checks before changing the worker topology.

At planning base `9cbe959120ab72d56e212ea27f9405992a4d6f58`, `npm run build` points to `eslint-project-specifc.config.js` rather than a Hugo production-build command. [CI](../../.github/workflows/ci.yml) runs tests and lint without building the site. Earlier verification required a compatible Hugo version; the older installed version did not understand the template layout. Development-browser success alone does not prove production worker URLs and generated assets are valid.

The [worker-build partial](../../layouts/_partials/build-js/configs/common/build-workers.html) fingerprints production worker assets. The application receives their paths through generated configuration. Removing a worker or changing its entry point needs a check of that output, not just a passing TypeScript unit test.

The earlier planning branch was `docs/20261029-worker-refactor-tatrs`. Implementation is complete through local verification and review; publication status is recorded below. This task concerns build verification, not deployment or a release.

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

- [x] `npm run build` performs the documented production site build from a clean checkout using supported, reproducible tool versions and locked npm dependencies.
- [x] CI runs the same build and fails when it fails. A controlled missing worker entry or broken build configuration is detected by the agreed isolated check.
- [x] Verify the generated worker map and referenced worker assets, including production fingerprints and the supported deployment base path. Removed workers do not leave required entries or broken references.
- [x] Run the asset checks against the current worker topology. Isolated missing-entry, stale-reference and incorrect-base-path cases fail for the expected reason. Record the migration contract above without requiring future worker assets to exist.
- [x] Build inputs and outputs are explicit. Fresh and repeated builds do not depend on stale ignored `public/` assets; generated output, model caches and retrieval indices are not committed.
- [x] Report warnings and environmental limitations accurately. Distinguish a successful site build and asset validation from successful model loading or answers in a browser.

## Dependencies

**Blocked by:** None. This is the first scheduled ticket.

- [CI setup](../20261027-121904/TASK.md) supplies the existing workflow.
- Coordinate toolchain and generated-source handling with the [TypeScript-check task](../20261029-195033/TASK.md), and runtime evidence with [application verification](../20261027-104746/TASK.md).

## Definition of Done

- [x] All acceptance criteria have recorded commands, tool versions, source revision and output evidence.
- [x] Complete applicable repository checks, cleanup, reviews and the final full suite in the implementation flow. Report available CI results without waiting for CI unless requested.
- [x] Document the reproducible local/CI build. No deployment, release or model-quality claim is part of completion.

Planning-stage next action was to inspect build inputs and choose toolchain and production-asset checks; completed in the record below.

## Implementation record

Mode: Autopilot through PR handoff, explicitly approved 2026-11-01 for scoped implementation, tests, documentation/ticket updates, reviews, signed commits, branch push, PR creation and CI/review fixes. No merge or deployment is authorized. Branch: `build/20261029-195034-production-ci`. Fixed review base: `8ae94942540e4758ed63090659a93724f41cac6b`.

Stage 2: scope is confirmed by the prepared ticket and Autopilot grant. Use Hugo Extended 0.158.0 (the recorded successful application baseline) and Node 24.19.0 with `npm ci`. Hugo was downloaded into an isolated temporary directory and verified against the official release checksum manifest. A baseline production build succeeds without generated retrieval data or model downloads; it reports existing missing taxonomy/term-layout warnings.

Verification seams: `npm run build` is the end-to-end build entry; a worker asset validator CLI reads the emitted manifest and files, compares source entry points, checks fingerprints, module references and deployment paths. Focused tests run the CLI against isolated valid and corrupted sites. These are routine implementation choices within the approved Autopilot scope. Asset checks do not execute inference or prove offline availability.

Criterion mapping: clean/repeated and subpath builds use `npm run build` and its base-URL override; asset failures use `node --test tests/production-assets.spec.js`; CI invokes the same build and focused checks; `npm run typecheck` and `npm run lint` cover repository compatibility. Final suite: `npm test`, after reviews. Runtime verification is the generated site's asset integrity at root and subpath; model/browser journeys belong to the next ticket.

Next action: stage 3, implement the build and validator with failing CLI regression cases first.

Stage 3 complete: `npm run build` now enforces pinned Node/Hugo versions, cleans public output, builds production assets with an isolated cache, and runs the asset validator. Hugo publishes a manifest from the application's own worker map. Seven public-CLI cases cover valid subpath output and corrupted maps/files/fingerprints/imports. CI installs the pinned toolchain and runs those checks plus root and subpath builds. Added locked postcss-cli: the fresh-source build exposed that Hugo's PostCSS executable was previously undeclared.

Stage 4 evidence: clean source was exported from the staged index into an isolated directory with no generated retrieval data or model cache. `ONNXRUNTIME_NODE_INSTALL_CUDA=skip PUPPETEER_SKIP_DOWNLOAD=1 npm ci` installed successfully. An initial plain install attempted an irrelevant optional native CUDA download and failed at the environment's direct network boundary; the documented and CI install now explicitly skips it. Root, repeated and https://example.test/demo/ builds passed with four workers and five JavaScript assets each. A stale worker file planted in public was removed by the repeat build, and the repeat worker manifest matched byte-for-byte. Existing taxonomy/term-layout warnings remain. No models or retrieval indices were generated or downloaded.

Deslop reviewed staged/unstaged changes against the fixed base; retained only build/asset validation and its tests/documentation. Product UI and inference are unchanged. Full browser/model journeys are inapplicable to this build-only ticket; static root/subpath artifact checks verify its runtime-facing contract. Blast-radius applicability: the only deletion is generated public output and this process's temporary build cache, not user or live data.

Next action: sign the implementation snapshot, run independent Standards and Spec reviews, then final npm test and publish the PR through handoff.

Review preparation correction: restored the base lockfile's existing optional-package libc metadata after npm 11.9 rewrote it incidentally. The only dependency additions are postcss-cli and its required transitive packages. The pending review results apply to the implementation snapshot plus this explicitly reviewed correction; final results will identify the final reviewed SHA.

Build instructions: [production build](../../docs/production-build.md). The final handoff will retain compact build logs and review/check results here.

Review fix: both reviewers reproduced a nested-page script URL false pass in the initial checker. Both review approvals, blast-radius disposition and final-suite results were invalidated before the fix. Added failing positive/negative nested-page CLI regressions, then retained each HTML document URL when resolving script references. Repeat focused checks, root/subpath artifact verification and both reviews against the corrected signed snapshot before publication.

### Final verification and handoff preparation

Stages 4–6 passed at signed implementation snapshot `af30655f4f913c38ed2ab3486162a6277f3d1f42`, against fixed base `8ae94942540e4758ed63090659a93724f41cac6b`. Repeat Standards review: zero actionable findings. Repeat Spec review: zero actionable findings. The nested-page defect is fixed, and the base lockfile's pre-existing package records are unchanged. Deslop and the build-only runtime verification were repeated after the fix. The blast-radius skill was read; no real-data bulk/destructive operation is present, so its live-data checks do not apply.

Final `npm test` after both reviews: **51 tests passed, 0 failed**, at that implementation SHA. `npm run lint`, `npm run typecheck`, nine focused CLI cases, authored-file Prettier and `git diff --check` passed. Retained build/install evidence is in [evidence/clean-install.log](https://github.com/ragemous3/personal-webpage/blob/241c1ff8ba4ea299cb544eac4d2820a2bb84eb6e/tasks/20261029-195034/evidence/clean-install.log), [evidence/clean-root.log](https://github.com/ragemous3/personal-webpage/blob/241c1ff8ba4ea299cb544eac4d2820a2bb84eb6e/tasks/20261029-195034/evidence/clean-root.log), [evidence/repeated.log](https://github.com/ragemous3/personal-webpage/blob/241c1ff8ba4ea299cb544eac4d2820a2bb84eb6e/tasks/20261029-195034/evidence/repeated.log) and [evidence/clean-subpath.log](https://github.com/ragemous3/personal-webpage/blob/241c1ff8ba4ea299cb544eac4d2820a2bb84eb6e/tasks/20261029-195034/evidence/clean-subpath.log). Commands and versions are in this record and the build instructions. The CI job invokes the tested commands; remote execution remains to be observed after publication and is not claimed as a local result.

The PR body describes implementation snapshot `af30655f4f913c38ed2ab3486162a6277f3d1f42`, using the project template and a small build-flow diagram under show-me guidance. Only ticket evidence/status changed after the final test. Stage 7 next action: sign/push this evidence, create the PR, record its URL and close this ticket through the repository publication workflow. No merge or deployment is authorized.

Stage 7 publication complete: [PR #19](https://github.com/ragemous3/personal-webpage/pull/19) is open against main. The ticket is CLOSED at PR handoff, as required by the repository workflow; this does not indicate merge or deployment. Four CI checks were queued at the initial status read, with no failures or unresolved threads. Auto-merge is disabled and no merge-queue entry exists. The prepared PR body is unchanged. Next action: hand off the open PR; reopen this ticket if CI or review finds an actionable issue. Browser verification ticket 20261027-104746 is next after this build change lands.
