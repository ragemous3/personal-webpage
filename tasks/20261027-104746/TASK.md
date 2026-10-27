# Create and prove application verification before code review

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Create a project-local verification skill for the Offline assistant and connect it to the implementation flow before code review. The skill must drive the real application, retain evidence, and distinguish a successful user journey from a passing unit test or a running HTTP server. Use the terminology in [GLOSSARY.md](../../GLOSSARY.md).

The user approved application verification only. Reassessing old work and limiting review rounds are outside this change.

The user subsequently chose to create the verification skill as a draft and keep the existing runtime fixes as prerequisites. Deliver the draft and workflow integration now; retain the live-run acceptance criterion for promotion to a proved skill.

## Prerequisites

- A Hugo version supporting the current template layout, installed project dependencies, and a working browser driver.
- The configured résumé index, chunks, and vector metadata for retrieval journeys.
- Working model initialization and response rendering for a complete question-and-answer journey. These are existing tickets listed below, not assumed to be complete.

## Acceptance criteria

- [x] A project-local verification skill provides Launch, Doctor, Drive, Evidence, Cleanup, and Helpers instructions grounded in the repository.
- [x] A feature map identifies real entry points, actions, observable results, and unmet prerequisites. Planned Local/Online controls are not described as existing features.
- [ ] Verification uses an isolated server/browser instance and preserves logs and evidence after cleanup. It reports failed or blocked journeys without substituting mocked services.
- [ ] The skill is exercised end to end against at least one real mapped feature, including cleanup and retained evidence. Until then, label it a draft and keep this ticket OPEN.
- [x] The implementation flow requires applicable runtime evidence after cleanup and before the signed snapshot and code review. It records exact limitations when verification cannot run.

## Dependencies

- [Connect design interviews to the TATR implementation flow](../20261010-214050/TASK.md).
- [Complete language-model worker initialization and query lifecycle](../20261011-184042/TASK.md).
- [Complete shared chat response and cancellation lifecycle](../20261022-202009/TASK.md).
- The installed create-verification-skill generator and the project's Puppeteer dependency.

## Definition of Done

- [ ] All acceptance criteria have evidence recorded.
- [x] Validate draft skill structure, local links, helper syntax, missing-dependency failure behavior, and whitespace. Browser behavior remains unverified.
- [ ] Record the exercised feature, exact commands, result, evidence paths, and cleanup outcome.
- [x] Keep unresolved application prerequisites visible; a failed launch or mocked test is not successful runtime verification.

Implementation state: requested draft delivered; live proof blocked by the listed prerequisites. No committed verification snapshot or Standards/Spec reviews yet. Next action: resolve launch prerequisites and the applicable runtime tickets, execute one mapped journey including cleanup, and record retained evidence before promoting the skill. Existing product implementation tickets retain their own scope and stage.

### Discovery evidence

- `hugo version`: Hugo 0.92.2 extended.
- `hugo --destination /tmp/personal-webpage-verification-build --cacheDir /tmp/personal-webpage-verification-cache`: exit 255; cannot resolve the `page-base/head` partial under `layouts/_partials`.
- `node --version`: v24.18.0; `npm --version`: 11.16.0.
- Importing the declared Puppeteer dependency fails with ERR_MODULE_NOT_FOUND in the current dependency installation.
- The `static/content-data` directory is absent.
- The existing model-worker and shared-response tickets describe incomplete runtime behavior. The current source still calls `localLLM.init` without constructing `localLLM`; the chat response handler logs data and the chat view renders no answer messages.

### Draft delivery and checks

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
