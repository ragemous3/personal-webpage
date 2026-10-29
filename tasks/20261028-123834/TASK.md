# Add persisted assistant configuration UI with live model settings

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Queued third by the user on 2026-10-29: [remove the hub worker](../20261029-193942/TASK.md) first (priority 300), [refactor state-machine ownership to Web Locks](../20261029-193941/TASK.md) second (priority 200), then this configuration feature (priority 100). TATR sorts higher priorities first.

This is the existing configuration ticket, reopened on the planning branch for integration after both refactors. Preserve the agreed product requirements below. The earlier implementation and its completion record remain available in [the historical ticket at snapshot 06dab29](https://github.com/ragemous3/personal-webpage/blob/06dab29ef08b28ddab9e8e7b7817011a40c1a2dd/tasks/20261028-123834/TASK.md) and [PR #15](https://github.com/ragemous3/personal-webpage/pull/15). The original branch and PR are unchanged by this queue update.

Add an unstyled visitor-facing configuration component, injected configuration service and repository, and persisted browser preferences. Keep Mode (Local/Online) separate from Model (initially Qwen only). Selected settings are the latest valid choices; active settings describe the runtime in use. Resolve saved preferences before startup, preserve conversations, and apply changes safely after accepted responses finish.

The earlier feature expanded into a parallel worker-management and routing path. Reassess its reusable UI, repository and service work after the two prerequisite refactors. Integrate with the resulting worker lifecycle rather than bringing back the superseded hub or a parallel ownership system. Online inference, extra models, styling and model-answer quality remain outside this ticket.

Planning branch: `docs/20261029-worker-refactor-tatrs`. Planning base: `9cbe959120ab72d56e212ea27f9405992a4d6f58`. Current state: queued; implementation is not resumed by this priority change. The unchecked criteria require verification against the future integrated implementation. Historical test/review passes apply only to their recorded snapshots.

## Prerequisites

- Complete both refactor tickets in the user-confirmed order.
- Review the resulting interfaces and update the configuration test seams, command mapping and runtime journeys before resuming implementation. Use the original feature branch as reference material and reuse suitable work deliberately.
- Preserve the existing composition, service, data and shared-contract rules. Composition injects browser storage and events; persistence details belong in the repository.
- Prepare compatible Hugo, Chromium and browser-generated retrieval data for real CPU verification. Keep generated data ignored; record unavailable hardware and baseline type diagnostics accurately.

### Agreed architecture and read path

Composition supplies the browser storage and storage-event dependencies to a data-layer configuration repository, then injects that repository through a shared contract into a configuration service. Use backend-independent names; do not name the service after localStorage.

The repository owns persistence keys, the serialized record format, schema version, JSON handling, and storage-event filtering. The configuration service calls typed repository methods such as load, save, and observe. It never passes raw storage keys or calls browser storage APIs. The component never accesses storage, workers, or model pipelines.

The configuration service combines validated saved preferences with site/model defaults and exposes a read-only stateful subscription. The component receives the current state on subscription and subsequent updates. Resolve saved preferences before starting model initialization. Inject runtime reconfiguration through a contract; composition wires concrete implementations, and the service coordinates the use case.

### Initial controls and defaults

The user delegated sensible parameter defaults. Use this initial bounded set rather than exposing every Transformers option:

| Setting | Default | Initial control |
| --- | --- | --- |
| Mode | Local | Local / Online |
| Model | Qwen1.5 0.5B Chat | A separate chooser with this single model |
| Execution | Auto | Auto / CPU / WebGPU |
| Precision | Q4 | Advanced: Q4 / Auto |
| Maximum new tokens | 256 | Advanced: integer 1–1024 |
| Sampling | Off | Advanced: off/on |
| Temperature | 0.7 | Advanced: shown when sampling is on; range 0.1–2 |
| Top-p | 0.9 | Advanced: shown when sampling is on; range greater than 0 and at most 1 |

Pass execution `auto` directly to the pipeline. Label browser `wasm` as CPU. Pass an explicitly selected precision `auto` through too; the default remains the model profile's known Q4 value. When sampling is off, retain its saved tuning values but omit inactive sampling parameters from the effective generation options. An explicit answer-token budget avoids the prior one-token result with empty generation settings. These defaults do not promise factual accuracy.

## Acceptance criteria

- [ ] Only one live model/retrieval runtime is hosted across tabs. Opening another tab must not load another model. The existing SharedWorker coordinates routing from requesting tabs to the live bot owner and routes streamed/final/error responses back to the requesting tab. Conversations and cancellation remain isolated by client and request identity. Do not bypass the shared-worker architecture with independent per-tab models.
- [ ] An unstyled configuration web component uses a configuration service through a shared contract and context/composition injection. Mode and Model are separate controls. Model initially has only the existing Qwen choice. Basic and Advanced controls follow the agreed defaults and validate supported values before updating settings.
- [ ] The service depends on a typed, injected configuration repository. Persistence keys, JSON, schema version, browser storage access, and storage-event handling stay in the data layer. Composition supplies localStorage and browser event dependencies. Views and services contain no direct localStorage calls or raw persistence keys.
- [ ] On startup, the service validates saved preferences, combines them with defaults, and publishes selected settings, active settings, pending/loading state, availability, and errors through a read-only stateful subscription. Subscribers receive the current state immediately. No model starts with defaults before saved preferences have been resolved.
- [ ] Local execution passes `auto` unchanged to both the generation and retrieval pipelines. CPU maps to `wasm`, and WebGPU maps to `webgpu`. Remove retrieval's hardcoded WebGPU requirement for this path. Preserve the retrieval model, embedding dimensions, normalization, matching index, and its compatible precision. Use the pipeline/runtime's internal Auto selection; do not add a competing application-level hardware selection or fallback algorithm.
- [ ] Valid edits update service state and persisted preferences without an Apply button. Invalid or incomplete input shows field feedback and does not replace the last valid settings. Persist requested Auto values, not a guessed or previously selected physical backend. Do not claim to know the actual provider unless the runtime exposes it reliably.
- [ ] An active retrieval/generation response finishes using its starting configuration. Configuration controls stay usable. Multiple edits coalesce into the latest complete valid combination. Apply that combination after the request reaches completion, failure, or explicit cancellation; settings edits themselves never cancel it. If idle, apply changes without waiting for another response. Edits during initialization also coalesce without overlapping uncontrolled model loads or allowing stale initialization to install an older selection.
- [ ] During a required runtime replacement, Send stays disabled until the selected configuration is ready. No new question slips through on the old configuration while a pending change is being adopted. Generation-only changes take effect for the next question without reloading model weights. Model/backend/precision changes replace or reuse runtime resources coherently, without orphan workers, duplicate listeners, or termination of resources still owned by another client.
- [ ] Changing any setting or mode preserves the current tab's conversation. Only the explicit conversation Reset action clears it. A replacement model receives appropriate retained history. Restore defaults and switching back are configuration operations, not conversation resets.
- [ ] Online is selectable and persisted, but displays “Online mode is not available yet” and disables Send. It makes no online inference requests, collects no credentials, and starts no unnecessary local model downloads. If selected during a response, that response finishes before the mode change takes effect. Returning to Local uses the retained local preferences and conversation. Do not pretend the local Qwen model is an online model.
- [ ] A failed configuration shows the requested setting/value or combination that failed, the available diagnostic, and a clear prompt to switch back. Do not guess a single culprit when the runtime only identifies a failing combination. Keep the conversation and selected settings visible; Send stays disabled until a configuration loads. Offer an explicit switch-back action to this client's last working configuration and Retry for the failed selection. If no previous working configuration exists, offer Restore defaults without claiming it is guaranteed to solve the failure. Do not silently roll back or answer with a different configuration.
- [ ] Saved changes propagate across tabs through the injected repository's observation interface. Each tab finishes its own active response before adopting the latest preferences, keeps its own conversation, and can keep editing settings. Ignore unrelated keys and stale callbacks, do not echo received changes into write loops, and ensure an older initialization result cannot overwrite newer preferences. Conversation history is not persisted by this feature.
- [ ] Missing saved data uses defaults. Malformed, unsupported-version, or invalid saved preferences cannot crash startup or bypass validation; recover to valid defaults with a visible notice. If storage access or writes fail, allow session-only operation and show that settings will not be remembered. Never clear unrelated browser storage.
- [ ] Public-interface tests cover loading/defaults, validation, requested-versus-active state, latest-change coalescing, response completion boundaries, configuration failures and switching back, shared resource ownership, stale initialization, and cross-tab updates. Browser component tests cover the actual controls, automatic updates without Apply, pending/error messages, preserved history, and the unavailable Online mode.

## Dependencies

- [Remove the hub worker](../20261029-193942/TASK.md), first.
- [Refactor bot ownership to Web Locks](../20261029-193941/TASK.md), second.
- [Shared chat response and cancellation lifecycle](../20261022-202009/TASK.md), including [PR #14](https://github.com/ragemous3/personal-webpage/pull/14).
- [Validated startup configuration wiring](../20261011-184041/TASK.md).
- [Draft real-application verification](../20261027-104746/TASK.md) supplies the browser verification procedure and records its remaining limitations. This ticket must retain its own runtime evidence.
- No online provider/backend is required; its implementation belongs to separate work.

## Definition of Done

- [ ] All acceptance criteria have evidence recorded. Keep any necessary model-quality or unavailable-backend limitation distinct from successful configuration/lifecycle behavior.
- [ ] Before implementation tests are written, confirm the proposed public test seams and command mapping below at the implementation gate. Then run the repository's implementation, deslop, runtime verification, Standards/Spec review, and applicable blast-radius stages against a fixed review base and signed implementation snapshot.
- [ ] Run focused tests, relevant type checks, full lint, the applicable Hugo build, and the final full test suite at the workflow's prescribed point. Record existing unrelated failures accurately instead of expanding this ticket into repository cleanup.
- [ ] Observe the real application with a clean profile and a returning profile: saved preferences before model startup; Local Auto and explicit CPU behavior; settings changed during a response; preserved history; switching to/from unavailable Online mode; an explicit failing setting and switch-back; and two tabs adopting changes after their own responses. Record unsupported hardware as a limitation, not a successful WebGPU run. Mocks do not establish real model loading or provider fallback.
- [ ] Follow the existing architecture and naming rules. Reuse shared contracts and the stateful subscription pattern. Add no styling and do not add an online inference implementation or additional model profiles.
- [ ] At publication, report the PR and any CI state already available, then hand off without waiting for CI completion. The user explicitly removed the CI wait requirement on 2026-10-28. Do not merge, enable auto-merge, enqueue, or deploy without separate authorization.

### Historical evidence and resumption

The historical ticket retains the full implementation chronology, failed per-tab loading attempts, review findings, commands and final evidence. Its [real CPU two-tab result](https://github.com/ragemous3/personal-webpage/blob/06dab29ef08b28ddab9e8e7b7817011a40c1a2dd/tasks/20261028-123834/evidence/review-fix-two-tab-pass.json) demonstrated two owner worker initializations and zero follower initializations for that implementation. Those results must not be presented as verification of the future refactored integration.

Next action: finish hub removal and state-machine refactoring, then revisit the configuration integration design and verification plan before resuming this ticket.
