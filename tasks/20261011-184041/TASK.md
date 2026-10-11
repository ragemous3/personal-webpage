# Complete validated configuration wiring for offline chatbot factories

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Commit e71295d changed Chat and DB to accept RagConfigBase configuration. StandardCommunication forwards its payload through the existing hub, whose worker uses payload.source to create named workers. Factory composition still uses old argument lists, leaving startup configuration incomplete.

Terminology: [Offline résumé assistant glossary](../../GLOSSARY.md).

## Prerequisites

Restore TypeScript parsing first. Repair existing invalid TOML semicolons/trailing commas in config/_default/params.toml so Hugo can read the startup configuration; preserve configured values. Install locked dependencies and introduce a focused test runner if needed. Preserve the user's pre-existing removal of the redundant WorkerKeys argument in the vector database factory.

## Acceptance criteria

- [ ] Hugo can parse the site parameters used for startup configuration.
- [ ] Both factory creation paths supply `(hub, stateMachine, broadcast, config)` with typed `{ name, payload }` configurations and preserve singleton behavior.
- [ ] Offline composition reads Hugo-normalized language-model and database params, adds built worker paths as source and site baseUrl, and validates all required configuration before creating worker resources.
- [ ] Model configuration validation checks model fields rather than database fields; database validation covers required baseUrl and rejects invalid supported values.
- [ ] Missing generation options use an empty options object; explicit valid options are preserved, and malformed values fail validation.
- [ ] Tests through composition/client and guard public interfaces cover valid startup messages, invalid configuration with no worker side effects, and singleton/non-singleton behavior. Fake browser worker and broadcast boundaries catch wiring errors without downloading models; they do not establish real worker loading or WebGPU support.
- [ ] Relevant type checks, focused tests, full available tests and Hugo build run; unrelated baseline failures are recorded without claiming a clean project build.

## Dependencies

[Restore TypeScript parsing for chatbot assets](../20261011-184040/TASK.md).

## Definition of Done

- [ ] All acceptance criteria have been verified, with evidence recorded.
- [ ] Signed implementation snapshot, Standards and Spec reviews and blast-radius disposition cover the latest implementation.
- [ ] Browser smoke-check results or an explicit remaining verification limitation are recorded.

Branch: feature/complete-offline-chatbot-refactor. Fixed review base: 9ae6426d1c4c917a5d8b2a7254860e9a607d053b. Current stage: ready for implementation; prerequisite parser ticket CLOSED. Latest implementation snapshot: none yet. Standards review: pending. Spec review: pending. Blast-radius review: pending.
Next action: install locked dependencies, repair invalid site-parameter TOML, then use test-first vertical slices at the confirmed public composition/worker-message boundary. Verification commands and harness will be recorded when selected from available tooling.

Follow-up outside this ticket: StandardCommunication appears to drop vectordb:query:response; LLM progress uses a different task name from its listener. Successful startup alone does not prove full retrieval and response delivery.
