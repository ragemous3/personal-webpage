# Complete language-model worker initialization and query lifecycle

- STATUS: CLOSED
- PRIORITY: 130
- TAGS: task

## Background

Commit 36652a8 moved pipeline and tokenizer loading out of LocalLLMData into the LLM worker. LocalLLMData now accepts initialized dependencies, but the worker never constructs it and calls a deleted init method. The tokenizer helper also references a nonexistent this.defaultLmModelName and declares the wrong return type.

Terminology: [Offline résumé assistant glossary](../../GLOSSARY.md).

## Prerequisites

Complete validated startup configuration wiring. Establish the focused test harness through the preceding ticket. Keep the existing model, device and dtype defaults unless valid explicit configuration overrides them.

## Acceptance criteria

- [x] A valid llm:init message loads the configured pipeline and tokenizer, derives the tokenizer limit and constructs LocalLLMData with configured generation options.
- [x] Readiness is emitted only after successful initialization; loading failures produce error messages associated with the requesting message.
- [x] Queries before initialization return a controlled error, and asynchronous query failures are awaited and returned through the worker error path.
- [x] Repeated initialization does not create overlapping successful model instances; a failed initialization can be retried.
- [x] Tests at the worker message interface use fake external model/tokenizer loaders and verify readiness, load failures, premature queries, retries and successful query responses. These tests catch lifecycle and message behavior without testing model quality or real WebGPU execution.
- [x] Relevant type checks, focused tests, full available tests and Hugo build run; unrelated baseline failures are recorded explicitly.

## Dependencies

[Complete validated configuration wiring for offline chatbot factories](../20261011-184041/TASK.md).

## Definition of Done

- [x] All acceptance criteria have been verified, with evidence recorded.
- [x] Signed implementation snapshot, Standards and Spec reviews and blast-radius disposition cover the latest implementation.
- [x] Browser smoke-check results or an explicit remaining verification limitation are recorded.

Branch: feature/20261011-184042-llm-worker. Fixed review base: ab5c0a9a17eb59c463b44a4639bd5e7114a8f65e. Current stage: complete; PR #11 merged. Latest implementation snapshot: 4c83e853e86425aa020080a023ad618d7d272e9d. Standards review: 4c83e853e86425aa020080a023ad618d7d272e9d, 0 actionable findings. Spec review: 4c83e853e86425aa020080a023ad618d7d272e9d, 0 actionable findings. Blast-radius review: 4c83e853e86425aa020080a023ad618d7d272e9d, not applicable.

Execution mode: Autopilot. On 2026-10-27, after the flow's explicit ticket-scoped grant was requested, the user authorized recording the Autopilot decision and starting ticket #1. The grant covers routine implementation decisions, applicable tests, cleanup, review fixes, in-scope documentation/comments and ticket updates, signed commits, pushing this task branch, creating or updating its PR, and handling CI/review findings through handoff. Scope is limited to this ticket's confirmed worker message/model-loading boundary and acceptance criteria. Requirements or interface changes require a new user decision. Merging, auto-merge, deployment, and live destructive operations remain outside this grant. Finish condition: an open, unmerged PR with accurate verification and review status. This fresh branch from current origin/main replaces the recorded parser branch, whose prerequisite work has already merged; the earlier review base is superseded.

Next action: none for this ticket. The shared chat response lifecycle remains tracked separately in [20261022-202009](../20261022-202009/TASK.md).

Closure: the user authorized merging PR #11, which merged on 2026-10-27 as `2de83ca38763c9c21ba805eca71c8cea236b73ec`. The merge contains final PR head `c93e135e560069f247abb254ccbaad1fcbfc0b39`; all five review threads were resolved. The recorded browser verification limitation and approved alternative verification remain applicable.

## Implementation and verification evidence

- The worker now loads the configured text-generation pipeline and tokenizer, reads the tokenizer limit, constructs LocalLLMData with configured generation options, and emits readiness only after successful initialization. Concurrent initialization shares one load; a failed model or tokenizer load can be retried. Queries before readiness and awaited generation failures produce errors carrying the request ID.
- Deslop cleanup removed stale worker comments and global request IDs, used early returns for validation, and retained only the injection boundary needed for the agreed worker message tests. Signed implementation snapshot: 1e14a7136dc75108104c2c903bea21dc45fd6bd4.
- Worker message tests use fake external model and tokenizer loaders. The initial test failed because the worker had no handler seam; it passed after implementation. The focused suite now covers initialization, progress, premature queries, model and tokenizer failures, retries, concurrent initialization, streamed output, and asynchronous query failures. `node --import ./scripts/typescript-test.loader.js --test tests/llm-worker.spec.js`: passed after the final test addition.
- The TypeScript test loader now rewrites relative imports only from project assets; its previous behavior rewrote CommonJS imports inside node_modules and prevented the worker test from importing Transformers under Node 24.18.0.
- `npm test`: 22 tests passed, 0 failed on the final implementation and test files when run outside the sandbox. The sandboxed run failed in the decision-CLI tests because its child Node processes received EPERM.
- ESLint on the changed worker, loader, and test files: passed. Prettier check: passed. `git diff --check`: passed.
- `./node_modules/.bin/tsc --noEmit --pretty false`: exit 2 with existing diagnostics outside the changed worker, including the missing chatbot context import, unused imports in llm.data.ts, and a complex vector database type. No diagnostic names the changed worker. These remain baseline issues, not a clean project type check.
- `hugo --destination /tmp/personal-webpage-llm-hugo-build --cacheDir /tmp/personal-webpage-llm-hugo-cache`: exit 255 with installed Hugo 0.92.2; it cannot resolve the `page-base/head` partial. No site build is claimed.
- [Verification Doctor](evidence/doctor.json): `BLOCKED`, `runtimeVerified: false`, after a read-only retry outside the sandbox to let it inspect Hugo. It reports Hugo 0.92.2, missing postcss CLI and résumé index files, and unresolved hnswlib-wasm. The complete question-and-answer journey also depends on the separate shared chat response ticket. No real browser journey or model loading is claimed. On 2026-10-27, the user explicitly approved the passing worker message tests as this ticket's alternative verification and authorized continuing to code review and an open PR with the browser limitation recorded.
- Review of 1e14a7136dc75108104c2c903bea21dc45fd6bd4: Standards found 0 hard violations and one nonblocking duplicated-test-setup judgement call. Spec found one actionable issue: a conflicting second llm:init could be acknowledged as ready for the first model. Both review results are invalidated for the fix pass; repeat both on the next signed snapshot.
- Fix pass: a worker-message regression test failed on the reviewed snapshot when a second init requested a different model during loading or after readiness. The worker now rejects conflicting configuration while preserving the first model and accepts retries after a failed load. Focused worker tests pass. `npm test`: 23 passed, 0 failed outside the sandbox. ESLint, Prettier, and `git diff --check` pass. Repeated TypeScript checking reports the same diagnostics outside the changed worker; the browser prerequisite report and approved alternative remain applicable.
- Signed fix snapshot: 1763d17549830ef3d3af3bc0e2df21be92e43650. Both review axes must cover this snapshot before publication.
- Repeat Standards review of 1763d17549830ef3d3af3bc0e2df21be92e43650: 0 documented-standard violations and 0 actionable findings. It noted only a nonblocking duplicated-test-setup judgement call. Repeat Spec review of the same snapshot: 0 findings; the conflicting-init issue is resolved.
- Blast-radius on 1763d17549830ef3d3af3bc0e2df21be92e43650: not applicable. The worker loads a model and sends messages; the test loader and test fixtures affect local test execution. This diff introduces no bulk or destructive write on real application data, and no live data operation was performed.
- Publication: the show-me-prepared PR body describes implementation snapshot 1763d17549830ef3d3af3bc0e2df21be92e43650 and includes the worker message sequence, exact checks, and browser limitation. [PR #11](https://github.com/ragemous3/personal-webpage/pull/11) was created against main; its body readback matched the prepared text. Git workflow status on publication head c211f7ac2733a45364ad1fcf5734c1b3c5067776 reported 0 CI checks, 0 unresolved threads, and no review on that head. No merge or auto-merge was requested.
- User feedback after publication: JSON-string comparison is unnecessary and treats equivalent generation option objects with different key order as different configurations. The worker still needs to reject genuinely conflicting repeated initialization. Both prior reviews and blast-radius disposition are invalidated for this fix pass; refresh the open PR after a new signed implementation snapshot.
- User-feedback fix: generation options now use a value comparison that accepts reordered plain-object keys and compares nested arrays, primitives, and cycles. The worker-message regression test failed before the fix and passes after it. `npm test`: 24 passed, 0 failed outside the sandbox after automatic approval review became available again. ESLint, Prettier, and `git diff --check` pass. Project-wide TypeScript checking still reports only the recorded diagnostics outside the changed worker. The existing browser prerequisite report and approved worker-test alternative remain applicable.
- Signed user-feedback fix snapshot: 3ec7f39d853e4e2a9bc9e4f51867d95ae53f7aa7. Repeat review results follow below.
- Repeat Standards review of 3ec7f39d853e4e2a9bc9e4f51867d95ae53f7aa7: 0 hard or actionable findings; it noted nonblocking judgement calls about comparator complexity and repeated test setup. Repeat Spec review: the key-order issue is fixed and conflicting initialization remains rejected; 0 implementation findings. It identified a temporary mismatch between the checked review Definition of Done and the pending review fields; the checkbox was cleared until these repeat reviews and blast-radius were complete, then restored here.
- Blast-radius on 3ec7f39d853e4e2a9bc9e4f51867d95ae53f7aa7: not applicable. The fix compares in-memory worker configuration and adds a worker-message regression test. It performs no bulk or destructive write on real data, and no live data operation occurred.
- PR review-comment fix: the generic recursive value comparison now lives in the shared utility layer, and language-model configuration comparison lives in a data-layer utility. The worker retains only message handling and model lifecycle responsibilities. Signed implementation snapshot: 8dcc7bfaec446142c968f79258d22c17944aff90.
- Review-comment fix checks: ESLint passed on the worker and both new utilities; Prettier and `git diff --check` passed. Project-wide TypeScript checking still reports the recorded diagnostics outside the changed files. The existing tests were not rerun for this structural extraction.
- Review of 8dcc7bfaec446142c968f79258d22c17944aff90: the five inline comments are addressed by the two utility boundaries, imports follow the data-to-shared dependency direction, and the worker's configuration behavior is unchanged. Standards and Spec review found 0 actionable issues. Blast-radius remains not applicable because the refactor only moves in-memory comparison functions and performs no bulk or destructive operation.
- User-feedback follow-up: removed the data-specific utility and its folder. The worker now compares complete language-model configurations through the shared `areValuesEqual` utility. Signed implementation snapshot: 4c83e853e86425aa020080a023ad618d7d272e9d.
- Follow-up checks: ESLint passed on the worker and shared utility; Prettier and `git diff --check` passed. Project-wide TypeScript checking reports the same diagnostics outside the changed files. Tests were not rerun for this structural follow-up.
- Review of 4c83e853e86425aa020080a023ad618d7d272e9d: the requested shared placement is implemented without a data-to-shared reverse dependency, repeated initialization still uses value comparison, and the worker retains the existing conflicting-configuration error path. Standards and Spec review found 0 actionable issues. Blast-radius remains not applicable because this comparison is in-memory and performs no bulk or destructive operation.
