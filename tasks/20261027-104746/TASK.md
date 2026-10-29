# Create and prove application verification before code review

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Create a project-local verification skill for the Offline assistant and connect it to the implementation flow before code review. The skill must drive the real application, retain evidence, and distinguish a successful user journey from a passing unit test or a running HTTP server. Use the terminology in [GLOSSARY.md](../../GLOSSARY.md).

The user approved application verification only. Reassessing old work and limiting review rounds are outside this change.

The user subsequently chose to create the verification skill as a draft and keep the existing runtime fixes as prerequisites. Deliver the draft and workflow integration now; retain the live-run acceptance criterion for promotion to a proved skill.

On 2026-10-29, the user accepted extending this existing ticket with reusable multi-tab browser verification. Keep the primary order of hub removal, state-machine/Web Locks refactoring and configuration. This ticket supplies reusable verification infrastructure; product fixes remain in their own tasks.

The discovery results below are historical. Later lifecycle work and configuration-branch CPU evidence supersede the claim that no real answer can be rendered. Refresh the tool/runtime baseline and distinguish native-browser coordination tests with controlled model responses from real-model application journeys. The original SharedWorker mock always returned `UNINITIALIZED`, hiding follower startup and ownership defects.

## Prerequisites

- A Hugo version supporting the current template layout, installed project dependencies, and a working browser driver.
- The configured résumé index, chunks, and vector metadata for retrieval journeys.
- Working model initialization and response rendering for a complete question-and-answer journey. These are existing tickets listed below, not assumed to be complete.
- Reassess the historical prerequisites against the selected implementation revision before treating any as a current blocker. Agree what the controlled browser harness covers and what still requires real CPU inference.

## Acceptance criteria

- [x] A project-local verification skill provides Launch, Doctor, Drive, Evidence, Cleanup, and Helpers instructions grounded in the repository.
- [x] A feature map identifies real entry points, actions, observable results, and unmet prerequisites. Planned Local/Online controls are not described as existing features.
- [ ] Verification uses an isolated server/browser instance and preserves logs and evidence after cleanup. It reports failed or blocked journeys without substituting mocked services.
- [ ] The skill is exercised end to end against at least one real mapped feature, including cleanup and retained evidence. Until then, label it a draft and keep this ticket OPEN.
- [x] The implementation flow requires applicable runtime evidence after cleanup and before the signed snapshot and code review. It records exact limitations when verification cannot run.
- [ ] A reusable harness runs the actual coordination code with native browser tabs, Worker, SharedWorker, MessagePort and Web Locks. It records initializations, terminations and live worker counts per tab, and cleans up only its own browser profiles and servers.
- [ ] Cover sequential/simultaneous tab opening, follower requests and isolated answers, cancellation, owner close/crash, reconnect/reload and failed initialization. Record the supported way to verify suspended/background tabs and back/forward navigation; distinguish a crash from a frozen owner still holding its lock.
- [ ] Keep controlled-model coordination results separate from a real CPU application journey using compatible browser-generated retrieval data. The harness can record known baseline failures without presenting them as passing user journeys; product corrections and their assertions belong to the implementing ticket.
- [ ] Retain reusable runner source and small evidence with source revision, exact commands, expected/actual results, worker counts and cleanup outcome. Evidence must survive loss of temporary directories. Keep generated data and evidence PNGs ignored.

## Dependencies

- [Connect design interviews to the TATR implementation flow](../20261010-214050/TASK.md).
- [Complete language-model worker initialization and query lifecycle](../20261011-184042/TASK.md).
- [Complete shared chat response and cancellation lifecycle](../20261022-202009/TASK.md).
- The installed create-verification-skill generator and the project's Puppeteer dependency.
- [Hub removal](../20261029-193942/TASK.md), [state-machine/Web Locks refactoring](../20261029-193941/TASK.md) and [configuration](../20261028-123834/TASK.md) consume these checks. Coordinate test seams without making harness creation depend on all product fixes being complete.

## Definition of Done

- [ ] All acceptance criteria have evidence recorded.
- [x] Validate draft skill structure, local links, helper syntax, missing-dependency failure behavior, and whitespace. Browser behavior remains unverified.
- [ ] Record the exercised feature, exact commands, result, evidence paths, and cleanup outcome.
- [x] Keep unresolved application prerequisites visible; a failed launch or mocked test is not successful runtime verification.
- [ ] Refresh historical blockers, document the native-browser harness and real-model coverage separately, and complete applicable repository checks and reviews for its implementation. Do not close product tickets as a side effect.

Current planning state (2026-10-29): OPEN for refreshed verification evidence and the reusable multi-tab harness. Next action: reassess the implementation base, agree the test seams and convert the retained diagnostic journeys into reproducible checks. No harness implementation or new runtime verification is claimed by this ticket update.

Historical draft-delivery state: requested draft delivered, with live proof then blocked by the listed prerequisites. Draft included in signed snapshot 30bc55205ab186244b597a4506a99e1f2b2b13d8; Standards and Spec review both found 0 actionable issues within the approved draft scope. Those results apply only to that earlier draft. Existing product implementation tickets retain their own scope and stage.

### Historical discovery evidence

- `hugo version`: Hugo 0.92.2 extended.
- `hugo --destination /tmp/personal-webpage-verification-build --cacheDir /tmp/personal-webpage-verification-cache`: exit 255; cannot resolve the `page-base/head` partial under `layouts/_partials`.
- `node --version`: v24.18.0; `npm --version`: 11.16.0.
- Importing the declared Puppeteer dependency fails with ERR_MODULE_NOT_FOUND in the current dependency installation.
- The `static/content-data` directory is absent.
- The existing model-worker and shared-response tickets describe incomplete runtime behavior. The current source still calls `localLLM.init` without constructing `localLLM`; the chat response handler logs data and the chat view renders no answer messages.

### Historical draft delivery and checks

- [Project verification skill](../../.agents/skills/verify-offline-assistant/SKILL.md), with three feature-map entries and executable Doctor/observation helpers. It lives alongside this repository's other Codex skills in `.agents/skills/`.
- [Implementation flow](../../docs/implementation-flow.md): runtime verification now follows deslop within stage 4, before the signed snapshot and code review. Required failures block advancement; changes without runtime effects record non-applicability.
- Skill creator `quick_validate.py .agents/skills/verify-offline-assistant`: exit 0, `Skill is valid!`.
- `node --check` on both helpers: exit 0. `observe.js --help`: exit 0.
- Doctor was exercised from the identical staged skill under `/tmp/personal-webpage-verification-skill/verify-offline-assistant/`, with the repository as cwd. Exit 1, `BLOCKED`, `runtimeVerified: false`; see [doctor.json](evidence/doctor.json). The sandbox initially prevented its Hugo subprocess; the recorded report is from the approved read-only retry outside the sandbox.
- The staged observation helper was invoked with `http://127.0.0.1:43127/ /tmp/personal-webpage-verification-observer-failure open`. Exit 1 because Puppeteer could not be resolved; [its retained report](evidence/observer-failure.json) records the failure. No browser or profile was created. This verifies failure reporting, not browser execution or cleanup of a running browser.
- The Hugo build was repeated with isolated `/tmp` output/cache paths to retain [hugo-build.log](evidence/hugo-build.log). Exit 255; no server was launched. This is a build failure, not a completed Launch/Doctor/Drive/Cleanup run.
- Local Markdown link check: 17 links across seven files passed before these evidence links were added. Final link validation includes the evidence links.
- `git diff --check`: exit 0. No product tests were run for this draft; project dependencies are incomplete and product code was not changed.
- The isolation and live-cleanup acceptance criterion remains unchecked. The first successful runtime journey, screenshots, and evidence-preservation check after a running instance are still required.
