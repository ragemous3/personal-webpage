# Complete language-model worker initialization and query lifecycle

- STATUS: OPEN
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

- [ ] All acceptance criteria have been verified, with evidence recorded.
- [ ] Signed implementation snapshot, Standards and Spec reviews and blast-radius disposition cover the latest implementation.
- [x] Browser smoke-check results or an explicit remaining verification limitation are recorded.

Branch: feature/20261011-184042-llm-worker. Fixed review base: ab5c0a9a17eb59c463b44a4639bd5e7114a8f65e. Current stage: 4, cleanup and runtime verification; approved alternative complete, signed snapshot pending. Latest implementation snapshot: none yet. Standards review: pending. Spec review: pending. Blast-radius review: pending.

Execution mode: Autopilot. On 2026-10-27, after the flow's explicit ticket-scoped grant was requested, the user authorized recording the Autopilot decision and starting ticket #1. The grant covers routine implementation decisions, applicable tests, cleanup, review fixes, in-scope documentation/comments and ticket updates, signed commits, pushing this task branch, creating or updating its PR, and handling CI/review findings through handoff. Scope is limited to this ticket's confirmed worker message/model-loading boundary and acceptance criteria. Requirements or interface changes require a new user decision. Merging, auto-merge, deployment, and live destructive operations remain outside this grant. Finish condition: an open, unmerged PR with accurate verification and review status. This fresh branch from current origin/main replaces the recorded parser branch, whose prerequisite work has already merged; the earlier review base is superseded.

Next action: create the signed implementation snapshot, then review the committed diff against the fixed base.

## Implementation and verification evidence

- The worker now loads the configured text-generation pipeline and tokenizer, reads the tokenizer limit, constructs LocalLLMData with configured generation options, and emits readiness only after successful initialization. Concurrent initialization shares one load; a failed model or tokenizer load can be retried. Queries before readiness and awaited generation failures produce errors carrying the request ID.
- Worker message tests use fake external model and tokenizer loaders. The initial test failed because the worker had no handler seam; it passed after implementation. The focused suite now covers initialization, progress, premature queries, model and tokenizer failures, retries, concurrent initialization, streamed output, and asynchronous query failures. `node --import ./scripts/typescript-test.loader.js --test tests/llm-worker.spec.js`: passed after the final test addition.
- The TypeScript test loader now rewrites relative imports only from project assets; its previous behavior rewrote CommonJS imports inside node_modules and prevented the worker test from importing Transformers under Node 24.18.0.
- `npm test`: 22 tests passed, 0 failed on the final implementation and test files when run outside the sandbox. The sandboxed run failed in the decision-CLI tests because its child Node processes received EPERM.
- ESLint on the changed worker, loader, and test files: passed. Prettier check: passed. `git diff --check`: passed.
- `./node_modules/.bin/tsc --noEmit --pretty false`: exit 2 with existing diagnostics outside the changed worker, including the missing chatbot context import, unused imports in llm.data.ts, and a complex vector database type. No diagnostic names the changed worker. These remain baseline issues, not a clean project type check.
- `hugo --destination /tmp/personal-webpage-llm-hugo-build --cacheDir /tmp/personal-webpage-llm-hugo-cache`: exit 255 with installed Hugo 0.92.2; it cannot resolve the `page-base/head` partial. No site build is claimed.
- [Verification Doctor](evidence/doctor.json): `BLOCKED`, `runtimeVerified: false`, after a read-only retry outside the sandbox to let it inspect Hugo. It reports Hugo 0.92.2, missing postcss CLI and résumé index files, and unresolved hnswlib-wasm. The complete question-and-answer journey also depends on the separate shared chat response ticket. No real browser journey or model loading is claimed. On 2026-10-27, the user explicitly approved the passing worker message tests as this ticket's alternative verification and authorized continuing to code review and an open PR with the browser limitation recorded.
