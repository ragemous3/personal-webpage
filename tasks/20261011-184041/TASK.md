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

- [x] Hugo can parse the site parameters used for startup configuration.
- [x] Both factory creation paths supply `(hub, stateMachine, broadcast, config)` with typed `{ name, payload }` configurations and preserve singleton behavior.
- [x] Offline composition reads Hugo-normalized language-model and database params, adds built worker paths as source and site baseUrl, and validates all required configuration before creating worker resources.
- [x] Model configuration validation checks model fields rather than database fields; database validation covers required baseUrl and rejects invalid supported values.
- [x] Missing generation options use an empty options object; explicit valid options are preserved, and malformed values fail validation.
- [x] Tests through composition/client and guard public interfaces cover valid startup messages, invalid configuration with no worker side effects, and singleton/non-singleton behavior. Fake browser worker and broadcast boundaries catch wiring errors without downloading models; they do not establish real worker loading or WebGPU support.
- [x] Relevant type checks, focused tests, full available tests and Hugo build run; unrelated baseline failures are recorded without claiming a clean project build.

## Dependencies

[Restore TypeScript parsing for chatbot assets](../20261011-184040/TASK.md).

## Definition of Done

- [x] All acceptance criteria have been verified, with evidence recorded.
- [ ] Signed implementation snapshot, Standards and Spec reviews and blast-radius disposition cover the latest implementation.
- [x] Browser smoke-check results or an explicit remaining verification limitation are recorded.

Branch: feature/20261011-184041-offline-config. Fixed review base: a55481504137263576105b5ad1dd0abaac9bc1f4. Current stage: code-review (extension fix); prerequisite parser ticket CLOSED. Stacked base branch: feature/complete-offline-chatbot-refactor ([PR #6](https://github.com/ragemous3/personal-webpage/pull/6)); merge the parser PR first. Latest implementation snapshot: ba8697d9fd6d254982e84e4167b9bffaf52ec176. Standards review: 26ba31211bc344722f88ef246cec910466806fee, invalidated pending extension fix review. Spec review: 26ba31211bc344722f88ef246cec910466806fee, invalidated pending extension fix review. Blast-radius review: invalidated pending extension fix review.
Published [PR #7](https://github.com/ragemous3/personal-webpage/pull/7), based on PR #6. Next action: review the extension fix, refresh blast-radius disposition, and push the PR update. The LLM initialization ticket remains queued.

Follow-up outside this ticket: StandardCommunication appears to drop vectordb:query:response; LLM progress uses a different task name from its listener. Successful startup alone does not prove full retrieval and response delivery.


### Implementation and verification evidence

- Existing hub-based startup is preserved. All required configuration is assembled and validated before worker/broadcast construction. Both DB factory paths now match the DB constructor, retaining the user's removal of its redundant WorkerKeys argument.
- Hugo-normalized database keys are mapped to the typed payload; built sources and site baseURL are supplied by composition. Missing generation options default to an empty object, and explicit serializable options are validated and preserved. System-message values are checked as strings.
- The new test command uses Node's built-in test runner with a small TypeScript/alias loader and the existing TypeScript dependency; no new package dependency or model download is needed. Verified with Node 24.18.0 and locked TypeScript 5.9.3. The loader transpiles only; the separate compiler command checks types.
- Red/green slices reproduced model guard rejection of a valid model config, acceptance of unsupported model settings, acceptance of missing database baseUrl, six resources created for invalid configuration, and non-string system messages accepted. Each now passes its regression check.
- `npm test`: exit 0, 10 tests passed, 0 failed. Covers guard validation, default and explicit generation options, worker startup envelopes, invalid inputs without worker/broadcast side effects, and singleton/non-singleton client behavior. The initial failed checks were recorded during implementation before each relevant fix.
- ESLint on all changed TypeScript/JavaScript files, test fixtures and eslint.config.js: exit 0, no output. `git diff --check`: exit 0. Prettier formatted the changed code and tests.
- `hugo config`: exit 0 after removing invalid semicolons/trailing comma without changing configuration values; the output confirms lowercased parameter keys.
- `./node_modules/.bin/tsc --noEmit --pretty false`: exit 2 with 20 pre-existing diagnostics. The parent snapshot a55481504137263576105b5ad1dd0abaac9bc1f4 was independently compiled from a temporary archive using the same installed dependencies: 23 diagnostics. Comparison found 0 new and 3 resolved diagnostics, all three in the factories. Remaining diagnostics affect the provider context import, shared message types, data model and LLM worker initialization. Full-project type correctness is not claimed.
- `hugo --destination /tmp/offline-config-hugo-build`: exit 255. Installed Hugo 0.92.2 does not recognize the repository's current layouts/_partials structure and reports a missing page-base/head partial. Configuration parsing succeeds; a full site build is not claimed.
- Browser smoke check was not performed: the installed Hugo cannot build the site, and real LLM initialization remains assigned to the dependent ticket. Mocked browser-worker tests establish configuration/message behavior, not actual model loading, WebGPU support or the complete RAG response path.
- No new ADR: this ticket completes the existing startup design rather than selecting a new architectural trade-off. Approved terminology remains in the linked glossary.

- Review fixes: renamed the TypeScript test loader to follow the responsibility suffix convention. Worker fakes now structured-clone messages. Red/green regressions reproduce nested non-serializable generation values allocating resources and invalid numeric options passing validation; both are rejected before allocation. Numeric domains now distinguish positive counts, nonnegative counts/token IDs, positive sampling scales and bounded probabilities, while preserving negative length penalties and empty suppression lists. Final focused tests: 10 passed. Type diagnostics remain identical to the previous 20-diagnostic baseline.
- Fix verification: ESLint on the generation guard, all test files and renamed loader exited 0; git diff --check exited 0. Both previous review results remain invalid until the fix snapshot is reviewed.
- Repeat review disposition: Standards and Spec independently reviewed 26ba31211bc344722f88ef246cec910466806fee against the pinned base with no unresolved findings. All three previous findings are resolved by d7eeb1ccd2a23da6d6105492ee06fd8e580c2c24. Spec reviewer independently ran npm test: exit 0, all three spec files passed.
- Blast-radius evidence for reviewed source snapshot 26ba31211bc344722f88ef246cec910466806fee: factory wiring invokes the existing worker initialization path. Its browser-local cache writes one named HNSW entry with store.put(data, this.key) in FILE_DATA; it introduces no bulk filters, deletion, account changes or messages to people. Tests use isolated fake workers and execute no live cache write. No bulk/destructive real-data operation applies.
- User-requested extension fix: the test loader, browser fixture and three spec files now use .js under the existing package type: module setting. Updated the npm test command and fixture imports. npm test exited 0 with 10 tests passed; ESLint on all renamed files and git diff --check exited 0. The rename leaves TypeScript source and configuration unchanged, so the recorded compiler baseline remains applicable.
