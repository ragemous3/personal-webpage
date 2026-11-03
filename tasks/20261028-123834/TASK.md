# Add persisted assistant configuration UI with live model settings

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

After the 2026-11-01 ticket consolidation and prioritization request, the sequence is [production build and CI](../20261029-195034/TASK.md) (priority 500), [application verification infrastructure](../20261027-104746/TASK.md) (400), [three SharedWorkers with RuntimeCoordinator lifecycle and recovery](../20261029-193942/TASK.md) (300), then this configuration feature (100). TATR sorts higher priorities first.

This is the existing configuration ticket, reopened on the planning branch for integration after the combined runtime refactor. Preserve the agreed product requirements below. The earlier implementation and its completion record remain available in [the historical ticket at snapshot 06dab29](https://github.com/ragemous3/personal-webpage/blob/06dab29ef08b28ddab9e8e7b7817011a40c1a2dd/tasks/20261028-123834/TASK.md) and [PR #15](https://github.com/ragemous3/personal-webpage/pull/15). The original branch and PR are unchanged by this queue update.

Add an unstyled visitor-facing configuration component, injected configuration service and repository, and persisted browser preferences. Keep Mode (Local/Online) separate from Model (initially Qwen only). Selected settings are the latest valid choices; active settings describe the runtime in use. Resolve saved preferences before startup, preserve conversations, and apply changes safely after accepted responses finish.

The earlier feature expanded into a parallel worker-management and routing path. Reassess its reusable UI, repository and service work after the prerequisite runtime refactor. Integrate with the resulting worker lifecycle rather than bringing back the superseded hub or a parallel ownership system. Online inference, extra models, styling and model-answer quality remain outside this ticket.

Planning branch: `docs/20261029-worker-refactor-tatrs`. Planning base: `9cbe959120ab72d56e212ea27f9405992a4d6f58`. Current state: queued; implementation is not resumed by this priority change. The unchecked criteria require verification against the future integrated implementation. Historical test/review passes apply only to their recorded snapshots.

**What to build:** let visitors change and retain assistant settings across visits and tabs while preserving each tab's conversation and completing accepted responses safely.

**Demo path:** change token settings without reloading the model, change execution settings during a response, observe one shared transition after accepted work finishes, then reload and confirm preferences are restored. Demonstrate unavailable Online mode and an explicit recovery from a failed configuration.

Planning publication: branch `docs/20261101-runtime-tickets-skills`, fixed base `1f2efdd54c68a7f94726e5aee6d8db2e064baab9`. The user authorized ticket refinement, repository skill installation, signed commits, branch push and PR creation. This publishes the plan only; this implementation ticket stays OPEN.

## Prerequisites

- Complete the combined RuntimeCoordinator refactor using the preceding build and verification infrastructure.
- Review the resulting interfaces and update the configuration test seams, command mapping and runtime journeys before resuming implementation. Use the original feature branch as reference material and reuse suitable work deliberately.
- Preserve the existing composition, service, data and shared-contract rules. Composition injects browser storage and events; persistence details belong in the repository.
- Prepare compatible Hugo, Chromium and browser-generated retrieval data for real CPU verification. Keep generated data ignored; record unavailable hardware and baseline type diagnostics accurately.

### Agreed architecture and read path

Composition supplies the browser storage and storage-event dependencies to a data-layer configuration repository, then injects that repository through a shared contract into a configuration service. Use backend-independent names; do not name the service after localStorage.

The repository owns persistence keys, the serialized record format, schema version, JSON handling, and storage-event filtering. The configuration service calls typed repository methods such as load, save, and observe. It never passes raw storage keys or calls browser storage APIs. The component never accesses storage, workers, or model pipelines.

The configuration service combines validated saved preferences with site/model defaults and exposes a read-only stateful subscription. The component receives the current state on subscription and subsequent updates. Resolve saved preferences before starting model initialization. Inject runtime reconfiguration through a contract; composition wires concrete implementations, and the service coordinates the use case.

### Initial controls and defaults

The user delegated sensible parameter defaults. Use this initial bounded set rather than exposing every Transformers option:

| Setting            | Default           | Initial control                                                         |
| ------------------ | ----------------- | ----------------------------------------------------------------------- |
| Mode               | Local             | Local / Online                                                          |
| Model              | Qwen1.5 0.5B Chat | A separate chooser with this single model                               |
| Execution          | Auto              | Auto / CPU / WebGPU                                                     |
| Precision          | Q4                | Advanced: Q4 / Auto                                                     |
| Maximum new tokens | 256               | Advanced: integer 1–1024                                                |
| Sampling           | Off               | Advanced: off/on                                                        |
| Temperature        | 0.7               | Advanced: shown when sampling is on; range 0.1–2                        |
| Top-p              | 0.9               | Advanced: shown when sampling is on; range greater than 0 and at most 1 |

Pass execution `auto` directly to the pipeline. Label browser `wasm` as CPU. Pass an explicitly selected precision `auto` through too; the default remains the model profile's known Q4 value. When sampling is off, retain its saved tuning values but omit inactive sampling parameters from the effective generation options. An explicit answer-token budget avoids the prior one-token result with empty generation settings. These defaults do not promise factual accuracy.

## Acceptance criteria

- [ ] Only one live model/retrieval runtime is hosted across tabs. Opening another tab must not load another model. RuntimeCoordinator routes requests to the shared generation and retrieval workers and routes streamed/final/error responses back to the requesting tab. Shared model settings apply across tabs; no tab owns the runtime. Conversations and cancellation remain isolated by client and request identity. Do not bypass the shared-worker architecture with independent per-tab models.
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
- [ ] Saved changes propagate across tabs through the injected repository's observation interface. The shared runtime finishes all accepted responses using their starting configuration before adopting the latest preferences once for all tabs. Each tab keeps its own conversation and can keep editing settings. Ignore unrelated keys and stale callbacks, do not echo received changes into write loops, and ensure an older initialization result cannot overwrite newer preferences. Conversation history is not persisted by this feature.
- [ ] Missing saved data uses defaults. Malformed, unsupported-version, or invalid saved preferences cannot crash startup or bypass validation; recover to valid defaults with a visible notice. If storage access or writes fail, allow session-only operation and show that settings will not be remembered. Never clear unrelated browser storage.
- [ ] Public-interface tests cover loading/defaults, validation, requested-versus-active state, latest-change coalescing, response completion boundaries, configuration failures and switching back, shared resource ownership, stale initialization, and cross-tab updates. Browser component tests cover the actual controls, automatic updates without Apply, pending/error messages, preserved history, and the unavailable Online mode.

## Dependencies

**Blocked by:** None. RuntimeCoordinator lifecycle and recovery merged in [PR #21](https://github.com/ragemous3/personal-webpage/pull/21), supplying the shared-runtime drain and replacement contract.

- [Three SharedWorkers with RuntimeCoordinator lifecycle and recovery](../20261029-193942/TASK.md), before this configuration integration.
- [Shared chat response and cancellation lifecycle](../20261022-202009/TASK.md), including [PR #14](https://github.com/ragemous3/personal-webpage/pull/14).
- [Validated startup configuration wiring](../20261011-184041/TASK.md).
- [Draft real-application verification](../20261027-104746/TASK.md) supplies the browser verification procedure and records its remaining limitations. This ticket must retain its own runtime evidence.
- No online provider/backend is required; its implementation belongs to separate work.

## Definition of Done

- [ ] All acceptance criteria have evidence recorded. Keep any necessary model-quality or unavailable-backend limitation distinct from successful configuration/lifecycle behavior.
- [ ] Before implementation tests are written, agree the public test seams and exact command mapping at the implementation gate. Then run the repository's implementation, deslop, runtime verification, Standards/Spec review, and applicable blast-radius stages against a fixed review base and signed implementation snapshot.
- [ ] Run focused tests, relevant type checks, full lint, the applicable Hugo build, and the final full test suite at the workflow's prescribed point. Record existing unrelated failures accurately instead of expanding this ticket into repository cleanup.
- [ ] Observe the real application with a clean profile and a returning profile: saved preferences before model startup; Local Auto and explicit CPU behavior; settings changed during a response; preserved history; switching to/from unavailable Online mode; an explicit failing setting and switch-back; and two tabs adopting changes after their own responses. Record unsupported hardware as a limitation, not a successful WebGPU run. Mocks do not establish real model loading or provider fallback.
- [ ] Follow the existing architecture and naming rules. Reuse shared contracts and the stateful subscription pattern. Add no styling and do not add an online inference implementation or additional model profiles.
- [ ] At publication, report the PR and any CI state already available, then hand off without waiting for CI completion. The user explicitly removed the CI wait requirement on 2026-10-28. Do not merge, enable auto-merge, enqueue, or deploy without separate authorization.

### Historical evidence and resumption

The historical ticket retains the full implementation chronology, failed per-tab loading attempts, review findings, commands and final evidence. Its [real CPU two-tab result](https://github.com/ragemous3/personal-webpage/blob/06dab29ef08b28ddab9e8e7b7817011a40c1a2dd/tasks/20261028-123834/evidence/review-fix-two-tab-pass.json) demonstrated two owner worker initializations and zero follower initializations for that implementation. Those results must not be presented as verification of the future refactored integration.

Next action: finish the combined RuntimeCoordinator refactor, then revisit the configuration integration design and verification plan before resuming this ticket.

### Integration investigation started after PR #21

The user approved merge and requested the next planned ticket. PR #21 merged as 62ffe3a60a5be907239b8c3d6a6e1427b6105e82 with four CI checks passing and all seven agreed review threads resolved. Resumed this ticket at stage 1 on feature/20261028-123834-integrate-settings, based on that merged revision. The separate open lint-debt ticket is not part of the planned feature sequence; full lint currently passes.

Initial inventory: historical snapshot 06dab29 provides the settings component/context, repository, service and their public-interface tests. The old configuration-runtime/shared-configuration-runtime worker ownership and RuntimeTransport must not be restored. Current RuntimeCoordinator exposes configure, begin/finish, readiness and onData; its state machine already drains accepted work before replacement. Composition currently starts model clients immediately, so saved settings must be resolved before that startup. Current shared snapshots expose resource state and configuring, but not a complete selected/active settings record; the integration must establish cross-tab state consistently without a parallel coordinator.

Proposed verification seams: repository load/save/observe with injected storage and events; service update/state subscription with a runtime contract; native MessagePorts for coordinator configuration/drain behavior; actual component controls in Chromium; real application saved-startup, Online/Local, retained history and two-tab settings journeys. Reuse suitable historical tests after replacing the obsolete transport fixtures. Focused commands and final design remain to be confirmed before implementation tests. Final suite remains npm test after both reviews. Routine run outputs follow the artifact policy and are not committed.

Mode selection is pending the explicit per-ticket question. No implementation or current browser proof is claimed by this inventory. Next: confirm mode and the integration seam/command mapping, then update the ticket and implement the first focused slice. The earlier ticket's explicit no-CI-wait handoff instruction remains in force for its eventual publication.

### Autopilot integration scope and test seams

User selected “Auto pilot” after the per-ticket question, granting implementation, routine design choices, tests/data preparation, documentation, independent reviews, signed commits, push, PR and CI/review fixes through handoff. Merge/deployment of the next PR are excluded. Branch feature/20261028-123834-integrate-settings; fixed review base 62ffe3a60a5be907239b8c3d6a6e1427b6105e82. Stages 0–2 resume this existing selected ticket; the queued product requirements remain unchanged.

Integration design: reuse the earlier repository/service/component public contracts and behavior, adapting a data-layer settings adapter to RuntimeCoordinator instead of the old ownership system. RuntimeCoordinator remains sole shared lifecycle owner and receives the desired effective configuration; browser storage remains injected into the preferences repository. Saved settings resolve before channels are hosted. Shared pending/active settings must be observable across tabs; accepted whole-response leases drain before application of the newest settings. Online is a disabled-send mode and never starts new model downloads.

Approved Autopilot routine seam mapping: tests/configuration-repository.spec.js covers injected load/save/observe and failure notices, not live model execution; tests/configuration-service.spec.js covers selected/active state, validation, coalescing and recovery through the public runtime contract; tests/configuration-runtime.spec.js covers the adapter and shared coordinator ports; tests/configuration-browser.spec.js covers actual unstyled controls, invalid fields, storage events and recovery UI. Native application verification covers production startup/tabs/history and real CPU model paths where prerequisites permit. Focused commands use node --import ./scripts/typescript-test.loader.js --test with the affected files; npm run typecheck, npm run lint and npm run build cover integration. Final npm test remains after both reviews. Evidence goes to ignored artifacts with concise summaries only. Begin stage 3 with the repository load/save/observe seam; reuse historical behavioral tests before restoring each corresponding implementation slice.

### Stage 3 integration checks

Implemented the settings repository/service/component using the agreed public seams, with DTOs under shared/models and exported contract interfaces under shared/contracts. New ConfigurationRuntime maps preferences to the existing coordinator protocol; no old owner runtime, Web Locks or dedicated-model workers were restored. Provider disposal releases its own subscriptions/channels. Saved Online mode hosts no model channels; saved Local settings replace startup defaults before hosting. The coordinator now shares requested/active settings, mode availability and pending-versus-loading state, coalesces queued edits, and preserves failed resource state until explicit connection repair. Retry restores only missing model connections with bounded deadlines and stale-attempt guards.

Red/green checks covered repository/service restoration, whole-response mode drain, queue coalescing, preservation of history while Send is gated, stale adapter-promise rejection and actual production settings controls. The public component fixture and production controlled-driver journey are distinct: the latter also exercises the real coordinator/model runtime, saved startup, both tabs, configuration failure and switch-back. The production journey caught a failed-port retry defect, corrected without hiding the failure. It also exposed duplicate custom-element registration; Hugo's component batch now remains the sole registration path. The reconnect fixture now attaches without first loading an arbitrary model configuration, retaining its strict initialization-count assertion.

Focused check command covers configuration-repository, configuration-service, configuration-runtime, configuration-browser, runtime-coordinator, chat-lifecycle, browser-verification and verification-artifacts: 62 passed. Full lint and TypeScript pass. Root and /resume/ builds each verify three worker assets and four JavaScript assets. Actionlint validates the updated workflow. Full suite remains pending until both reviews.

Native settings journey passed with no page errors. Real CPU/cache runs passed, including two-tab answers, surviving-tab use, Cancel/Reset, Auto selection passed unchanged to the framework, a real Auto answer, explicit restoration of CPU with history preserved, and a new browser process answering with zero returning model downloads. No actual provider was inferred from requested Auto. Successful explicit WebGPU operation is unverified; the controlled journey tests its error/switch-back behavior without claiming GPU hardware support or model factual accuracy. Final source-matched reruns remain in progress before the signed review snapshot.

Routine output stays ignored. The workflow's optional local_report attachment validates the exact source digest and labels submitted evidence separately from hosted execution. A mismatched report was rejected; a matching real report was accepted locally. This supplies reviewable JSON evidence without committing it. Referenced local cache screenshots are not implied to have been uploaded. Next: finish source-matched native runs, signed stage 4 snapshot and both reviews.

Supplemental coordinator-suite disposition: after correcting the fixture preload, concurrent reconnect passes with the strict initialization count. The broader run has 16 PASS and one intermittent forced-coordinator-target-close failure. The same forced-close scenario failed on the unchanged pre-follow-up base during the earlier artifact-policy comparison, as recorded in ticket 20261103-131627. This probe uses no settings selection/configuration and does not enter the new ensureModels path; no change to that recovery algorithm is included here. It remains disclosed baseline behavior, not a passing journey. Required settings/failed-configuration/CPU/cache journeys are assessed separately under this ticket's instruction to record unrelated baseline failures without expanding into cleanup.

### Stage 4 signed review snapshot

Final required settings journey PASS at artifacts/verification/settings-2026-11-03T21-49-23-062Z-2c7cfdc2-1d09-41c4-8f52-16f7c64a0feb/: zero page errors, saved Online startup with zero model initialization, both tabs adopting settings, response-boundary coalescing, accurate waiting/loading state, retained history, explicit failed-setting switch-back and reload persistence. Final real CPU/Auto/cache journey PASS at artifacts/verification/cache-2026-11-03T21-50-00-338Z-936bc2aa-9423-4441-8f75-863ff73af8cb/: real Auto answer, CPU restoration, history preserved, two-tab use, Cancel/Reset and cached-browser restart with zero model requests. Its source digest matches the complete current source. All owned browsers/servers/scratch directories cleaned up with retained output. These are local paths; hosted artifact publication remains pending.

The supplemental coordinator run records 16 PASS and the known forced-close baseline failure; the corrected strict concurrent-reconnect case passes. This is not represented as 17 passing scenarios. Deslop found no further necessary edits after the verified fixes. Stage 4 verification is complete for the settings scope. Next: independent Standards and Spec review of this signed source snapshot against fixed base 62ffe3a60a5be907239b8c3d6a6e1427b6105e82; final full suite and publication remain pending. The ticket's explicit no-CI-wait handoff instruction is retained.

### Review fix pass

Initial Standards review of 8381ca803c212b988bc390e40af180c98ac96b3b found no documented violations and one low-priority duplicate preference-seeding helper; the helper is now shared. Spec found P1 delayed Local configuration overtaking a newer Online request, and P2 stale selected/active state in session-only tabs without a storage event. Both review results and later gates were invalidated before fixes.

Public-seam red regressions reproduced channel hosting for obsolete Local, stale Auto state after a shared CPU update, and the reviewer's delayed configure dispatch order. Fixes invalidate superseded selections after connection readiness and defer initial channel hosting until the latest successful Local configuration. The service adopts authoritative shared selected/active state without saving it, queues snapshots during an in-flight local edit, and reconciles after that edit settles. An additional regression preserves newer local choices during the wait. Focused adapter/service checks now pass all 15 cases; lint/type checks pass. Next: affected production/real-model verification, signed fix snapshot, then both reviews again. No final full-suite or publication yet.

### Review-fix verification completion

The P1 and P2 fixes pass their public-interface regressions, including dropping delayed obsolete Local submissions, deferring obsolete channel hosting, session-only shared-state adoption with zero persistence writes, and preserving a newer local edit during reconciliation. Browser verification added a storage-denied third tab. Follow-up red/green regressions also prevent a cached-pending microtask loop, implicit retry of a failed selection during port repair, stale startup configuration on channel reattachment, and false readiness while a shared model reloads. Repaired model registrations now defer initialization until a fresh configuration command arrives, and pre-host startup retains the normal registration deadline. The shared preference-seeding helper resolves the Standards duplication finding.

Focused checks pass 72 cases; full lint, TypeScript and whitespace checks pass. The affected production settings journey passes with zero page errors at artifacts/verification/settings-2026-11-03T22-18-18-914Z-ebdcea9c-d126-4705-96ac-fdbf5249717b/. This includes saved Online startup, two-tab changes, accepted-response boundaries, backend failure/switch-back, reload, and shared state with a storage-denied tab. Earlier interrupted browser runs are accurately retained as ERROR and are superseded, not passing evidence. The environment restarted after these checks; source, artifacts and toolchain files survived unchanged. A final real CPU/Auto/cache rerun is in progress for exact-source report publication before the repeated reviews.

Review-fix stage 4: the final real CPU/Auto/cache rerun PASS at artifacts/verification/cache-2026-11-03T22-19-14-393Z-995bf61e-7fd8-4022-b9e5-97f4f9bd1092/. Its source digest matches the current complete source; returning model downloads are zero. Native settings (including the storage-denied third tab), 72 focused checks, lint and TypeScript pass. The repaired-port and channel-reattachment regressions confirm that failed settings are not restarted before the replacement command and latest settings survive reattachment. Resource reloads remain pending/unavailable until actual readiness; observed repair cannot silently retry a failed selection. Cleanup review found no further necessary changes. All earlier review findings are addressed; both reviewers must assess the new signed snapshot. Full-suite result is still pending under the prescribed review order. Routine evidence remains ignored, with matching local JSON publication prepared for handoff.
