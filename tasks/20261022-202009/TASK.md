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

Implementation state: design confirmed; queued after the local-model initialization ticket. No implementation branch, fixed review base, or implementation snapshot assigned yet. Next action: finish the prerequisite, then implement this ticket at the agreed service/worker/browser boundaries. Pin the review base when implementation begins.
