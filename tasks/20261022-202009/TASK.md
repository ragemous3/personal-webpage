# Complete shared chat response and cancellation lifecycle

- STATUS: OPEN
- PRIORITY: 120
- TAGS: task

## Background

Complete the shared chat response and cancellation lifecycle so local and online modes can reuse the chat service contract, message state, and unstyled chat view. This is a prerequisite for the agreed configuration feature, not an expansion of the local-model initialization ticket.

Observed gaps: StandardCommunication drops vectordb:query:response; RagService logs chat responses without publishing messages; ChatMessageModel cannot update streamed answers or reset history; the chat component neither subscribes to nor renders messages. Its submit binding and the offline provider's context import also need repair. Repeated initialization currently adds subscriptions, and cancellation is absent from the public service/worker interfaces.

Terminology: [Offline résumé assistant glossary](../../GLOSSARY.md).

## Prerequisites

Complete the existing local-model initialization ticket. Use the existing worker, service, message-model, and subscription boundaries. Preserve the current résumé retrieval behavior and configured model defaults.

## Acceptance criteria

- [ ] A submitted question travels through résumé retrieval to the local language model; retrieval responses reach the service, and the view receives and renders message updates. Repair the provider context import and form submission needed for this path.
- [ ] The shared chat interface represents initialization, readiness, an active response, completion, and errors. Text chunks update one assistant message in order; the final response does not duplicate streamed text. Request identity distinguishes active responses from stale callbacks.
- [ ] Initialization and attachment are repeatable without duplicate subscriptions. Disconnection releases the caller's subscriptions; disposal does not invalidate resources still owned by another client. Cached clients can be reattached or recreated coherently.
- [ ] The shared lifecycle exposes cancellation and conversation reset for the later mode selector. Cancellation stops active local generation rather than merely hiding its output. Late initialization or response callbacks cannot repopulate a reset conversation.
- [ ] An already-loaded local generation model may remain idle in memory after cancellation for reuse. Retaining the model does not retain conversation history or active subscriptions belonging to the removed chat.
- [ ] Only one question is active per chat. Send is disabled while initializing or responding. Questions and answers render as plain text with plain loading/error indicators and no added styling or Markdown rendering.
- [ ] A failed partial answer remains visible and is marked interrupted. Explicit Retry replaces the failed assistant attempt without duplicating the user's question. There is no automatic retry.
- [ ] Tests through service and worker interfaces, using fake transports/model loaders and controlled callbacks, cover retrieval routing, chunk/completion ordering, cancellation, stale responses, reset, retries, and repeated attachment without duplicate listeners. Browser component tests cover submission, message rendering, and readiness/error states.

## Dependencies

- [Complete language-model worker initialization and query lifecycle](../20261011-184042/TASK.md).
- [Completed startup configuration wiring](../20261011-184041/TASK.md).

## Definition of Done

- [ ] All acceptance criteria have verification evidence recorded.
- [ ] Run focused tests, the full available suite, relevant lint/type checks, and the applicable Hugo build. Record unrelated baseline failures explicitly; this ticket does not require a repository-wide cleanup.
- [ ] Record a real local-model/browser smoke-check result or the exact remaining verification limitation. Fake model tests do not establish real model loading, WebGPU support, or model quality.
- [ ] Complete the repository's implementation, Standards/Spec review, and applicable blast-radius stages against the implementation snapshot; record the commands, outcomes, and reviewed commit IDs.

Implementation state: stage 5, Standards and Spec review. Both prerequisite tickets are CLOSED. Branch: `feature/20261022-202009-chat-lifecycle`. Fixed review base: `a0a56ffd307aa3caacda0b372c2bbfff5955cd03`. Latest implementation snapshot: `5e6a1af`. Both code reviews, blast-radius review, and the final full-suite run remain pending. The implementation snapshot has a verified SSH signature from the supplied key.

Execution mode: Autopilot. The user selected "Start implementation auto pilot" on 2026-10-28 for this ticket. Authorization covers routine implementation decisions, tests, cleanup, review fixes, in-scope documentation/comments/ticket updates, signed commits, branch pushes, PR creation/updates, and CI/review fixes through handoff. Finish with an open, unmerged PR. Merge, deployment, and live destructive operations require separate authorization.

Scope additions approved on 2026-10-28: generate matching résumé data with the existing `scripts/create-index` helpers and keep it ignored; install Matt Pocock's TDD and code-review skills in the repository. Both skills and all supporting files were copied without modification from `mattpocock/skills` revision `59db609eb1e18aaf59b63284d0e52255aff0c63c`. The setup reference now selects those local copies. The index downloader preserves source JSON, waits for completed downloads, uses an isolated temporary directory, and trusts the configured proxy CA by its public key when supplied. Generated files remain under the existing `static/content-data/` ignore rule.

Confirmed seams: service and worker public interfaces with fake transports/model loaders and controlled callbacks; browser component submission, rendering, and readiness/error states. These establish lifecycle behavior but cannot prove real model loading, WebGPU, or answer quality. Focused checks: `node --import ./scripts/typescript-test.loader.js --test tests/chat-lifecycle.spec.js tests/chat-transport.spec.js tests/llm-worker.spec.js tests/chat-browser.spec.js`. The browser fixture also builds, persists, reloads, and queries a real HNSW index with a fixed embedding. Run `npx tsc --noEmit --pretty false` and full lint. Final full-suite command: `npm test`. Runtime journey: submit a real résumé question, observe streamed and completed text, cancel/reset, and explicitly retry an interrupted response using the real application. Next action: finish the requested CPU runtime journey, then sign the implementation snapshot and run both reviews.

### Implementation evidence

- Initial service regression failed because retrieved content never reached the model transport. It now passes with one rendered assistant answer and no duplicated final text.
- Cancellation regression failed because no stopping criterion reached generation. It now verifies an interrupted Transformers stopping criterion, suppressed late output, and preserved request identity.
- The real CPU browser journey exposed a nested-vector conversion failure in HNSW retrieval. The query now uses a flat float32 vector and accepts all labels instead of rejecting every neighbor. The Chromium regression uses real browser HNSW storage and finds the expected neighbor at distance zero.
- The content repository called `loadJSON` without its required parser. A failing public-interface test reproduced `parse is not a function`; validated résumé chunks now load successfully.
- Focused command above: 18 tests passed, 0 failed. Covers streaming/completion, stale callbacks, cancel/reset/retry, partial failures, ownership/reconnection, transport envelopes, real HNSW querying, and real Chromium view rendering. Browser and worker tests use controlled model outputs; runtime evidence is recorded separately.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`: five existing errors remain, compared with six before implementation. The missing content parser diagnostic is resolved. Remaining diagnostics concern `RagStates`, the existing embedding pipeline union, and three ignored `public/` imports. No clean full type check is claimed.
- Hugo 0.158.0 builds successfully into isolated `/tmp` output/cache/resource directories. Existing taxonomy/term layout warnings remain.
- The configured WebGPU run displays an explicit GPU-adapter initialization error in this environment. The user requested CPU testing. An isolated source copy sets both models to browser `wasm` (CPU), without changing committed defaults. Both models reach ready, retrieval loads the generated browser index, and a submitted question generates and renders text. Empty generation settings produce only one token; the final CPU run uses an explicit 64-token verification budget.
- `static/content-data/{index.json,chunks.json,contents.bin,vector-metadata.json}` are generated in Chromium with `scripts/create-index`. All four remain ignored. Generated Vite bundles were moved outside the repository after use so the full lint command checks source files rather than generated third-party bundles.

### Runtime verification and cleanup

- [Doctor](evidence/doctor.json): all prerequisites present with Hugo 0.158.0, Chromium 154, and the generated data. HNSW is checked at its actual browser module file rather than treated as a Node main entry.
- [WebGPU run](evidence/webgpu-runtime.json): the page reports the missing GPU adapter through its error state and Retry control. Software WebGPU also failed to complete initialization within the observation window. No WebGPU success is claimed.
- [Final CPU lifecycle run](evidence/cpu-lifecycle.json): PASS for lifecycle behavior on the real Hugo page. Button submission produced a visible model answer and returned to ready. A second question submitted with Enter reached the real model transport; Cancel interrupted it. Retry retained four messages (two user questions and two assistant attempts), and Reset left zero messages after a two-second late-callback observation. [Answer screenshot](evidence/cpu-lifecycle-answer.png); [reset screenshot](evidence/cpu-reset.png).
- Exact command: `CHAT_RUNTIME_ROOT=/tmp/chat-lifecycle-cpu-source.4kWc11 node /tmp/chat-lifecycle-runtime.mjs`. The [retained runner source](evidence/runtime-runner.txt) launches its own Hugo and Chromium, sends real form/button actions, and records results. Its read-only worker-message instrumentation observes when model requests are sent; it does not replace transports or model outputs. The isolated copy matches the implementation with three verification overrides: localLM device `wasm`, retrieval pipeline device `wasm`, and localLM generation `max_new_tokens = 64`.
- Both owned browser and Hugo server stopped. The browser profile and runtime scratch were removed; evidence remains. The generated index stays ignored in the working repository. The isolated CPU source is retained under `/tmp` for reproduction.
- Model quality limitation: the answer demonstrates retrieval/generation/rendering but includes an unsupported "Open RMM" claim. Grounding quality is not established. The ticket does not change model choice, production device defaults, generation defaults, or prompting. The real Cancel check exercised an active model request before visible text; nonempty partial-answer retention is additionally covered by the service and Chromium fixture tests.
- Initial control-run evidence is retained separately: the short answer completed before a visible-chunk cancellation condition could observe it. The final runner uses actual model-request dispatch plus the responding state instead. That initial attempt is not counted as a passing control journey.
