# Complete language-model worker initialization and query lifecycle

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Commit 36652a8 moved pipeline and tokenizer loading out of LocalLLMData into the LLM worker. LocalLLMData now accepts initialized dependencies, but the worker never constructs it and calls a deleted init method. The tokenizer helper also references a nonexistent this.defaultLmModelName and declares the wrong return type.

## Prerequisites

Complete validated startup configuration wiring. Establish the focused test harness through the preceding ticket. Keep the existing model, device and dtype defaults unless valid explicit configuration overrides them.

## Acceptance criteria

- [ ] A valid llm:init message loads the configured pipeline and tokenizer, derives the tokenizer limit and constructs LocalLLMData with configured generation options.
- [ ] Readiness is emitted only after successful initialization; loading failures produce error messages associated with the requesting message.
- [ ] Queries before initialization return a controlled error, and asynchronous query failures are awaited and returned through the worker error path.
- [ ] Repeated initialization does not create overlapping successful model instances; a failed initialization can be retried.
- [ ] Tests at the worker message interface use fake external model/tokenizer loaders and verify readiness, load failures, premature queries, retries and successful query responses. These tests catch lifecycle and message behavior without testing model quality or real WebGPU execution.
- [ ] Relevant type checks, focused tests, full available tests and Hugo build run; unrelated baseline failures are recorded explicitly.

## Dependencies

[Complete validated configuration wiring for offline chatbot factories](../20261011-184041/TASK.md).

## Definition of Done

- [ ] All acceptance criteria have been verified, with evidence recorded.
- [ ] Signed implementation snapshot, Standards and Spec reviews and blast-radius disposition cover the latest implementation.
- [ ] Browser smoke-check results or an explicit remaining verification limitation are recorded.

Branch: feature/complete-offline-chatbot-refactor. Fixed review base: 9ae6426d1c4c917a5d8b2a7254860e9a607d053b. Current stage: queued for implementation. Latest implementation snapshot: none yet. Standards review: pending. Spec review: pending. Blast-radius review: pending.
Next action: implement at the confirmed worker message/model-loading boundary after the configuration ticket completes.
