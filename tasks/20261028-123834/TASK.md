# Add persisted assistant configuration UI with live model settings

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Add a visitor-facing configuration web component for the assistant. Visitors need to choose a mode and local model settings without editing site configuration or losing their conversation. Remember their choices in the browser and follow the repository's composition, service, data, and shared-contract boundaries.

This is a new feature ticket, linked to the completed startup wiring and shared chat lifecycle work. Do not reopen those tickets. The requirements below come from the user's design interview. This request covers design and ticket creation; implementation and publication are separate work.

Confirmed terminology:

- **Mode:** Local or Online. This is separate from the selected model.
- **Model:** the named model profile. Initially the only choice is Qwen1.5 0.5B Chat (`Xenova/Qwen1.5-0.5B-Chat`).
- **Selected settings:** the visitor's latest valid choices, including changes waiting for an active response to finish.
- **Active settings:** the configuration used by the current runtime. An active response keeps the settings with which it started.

The components remain unstyled. Actual online inference, API credentials, additional models, prompt tuning, and answer-quality improvements are outside this ticket.

## Prerequisites

- Use a base containing the shared chat lifecycle from [20261022-202009](../20261022-202009/TASK.md), published on [PR #14](https://github.com/ragemous3/personal-webpage/pull/14). That ticket is CLOSED, but PR merge is separate from ticket closure. Do not assume the lifecycle is already on main.
- Reuse the validated startup configuration from [20261011-184041](../20261011-184041/TASK.md), the existing Lit/context composition pattern, and the stateful subscription utilities. Read the architecture and dependency rules in [README.md](../../README.md).
- Inspect worker ownership and replacement before adding runtime reconfiguration. The current LLM worker rejects changed initialization configuration, both factories cache clients without adopting replacement configuration, and the hub replaces its worker-map entry without terminating the previous worker. Repeated hosting alone is not a safe reconfiguration mechanism.
- For real browser verification, use compatible Hugo, installed dependencies, Chromium, and matching generated resume data. Keep generated data ignored. Browser CPU execution uses WASM. WebGPU success requires suitable hardware.

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

### Proposed verification mapping

These seams follow the confirmed architecture. Their detailed test plan has not yet been explicitly approved; confirm it before implementation under the repository's TDD rules.

| Seam | Proposed focused command | Coverage and limits |
| --- | --- | --- |
| Configuration service, injected repository/runtime contracts | `node --import ./scripts/typescript-test.loader.js --test tests/configuration-service.spec.js` | Settings state, validation, deferral/coalescing, errors, switch-back, preserved history; controlled callbacks do not prove a real model reload. |
| Configuration repository with injected storage/events | `node --import ./scripts/typescript-test.loader.js --test tests/configuration-repository.spec.js` | Keys, serialization, schema, corrupt data, denied/quota errors, observation, and write-loop prevention; fake storage cannot prove browser cross-tab behavior. |
| Runtime/worker public interfaces with controlled model loaders | `node --import ./scripts/typescript-test.loader.js --test tests/configuration-runtime.spec.js` | Exact Auto/WASM/WebGPU values, generation-only updates, replacement ownership, stale loads, no unnecessary model reload; no claim about GPU support or model quality. |
| Browser web component and two pages sharing real localStorage | `node --import ./scripts/typescript-test.loader.js --test tests/configuration-browser.spec.js` | Controls, live updates, localStorage round-trip, real storage events across tabs, pending/error behavior; controlled model transport remains distinct from real inference. |

Relevant checks: `node node_modules/typescript/bin/tsc --noEmit --pretty false`, `npm run lint`, the compatible Hugo build, and `git diff --check`. Final full-suite command: `npm test`. Use the real-application verification skill for the journeys above and retain source revision, overrides, actions/results, screenshots/logs, and cleanup evidence.

Implementation state: design interview complete; OPEN backlog ticket. The user confirmed Mode Local/Online, separate Qwen-only model choice, pipeline-managed Auto, injected storage with persistence details in the data layer, read-only service subscriptions, unstyled components, deferred live changes without Apply, preserved conversation, unavailable Online behavior, configuration-error details and an explicit switch-back prompt, and cross-tab propagation. The final “Q1. Yes” is interpreted in context as the answer to Q11 about multiple tabs.

### Implementation progress

- Mode: Autopilot, explicitly approved by the user on 2026-10-28 (“Yepp lets go”). This grant covers implementation, the proposed service/repository/runtime/browser test seams and command mapping, real CPU verification, cleanup, review fixes, in-scope documentation/comments/ticket updates, signed commits, branch pushes, and an open PR. No CI wait, merge, release, or deployment is authorized.
- Selected ticket: resume this configuration feature. Existing lifecycle/startup tickets remain CLOSED; verification and lint backlog tickets are not expanded here.
- Branch: `feature/20261028-123834-assistant-configuration`.
- Fixed review base: `9cbe959120ab72d56e212ea27f9405992a4d6f58` (fetched main, includes merged PR #14).
- Stage 0–2: existing design and proposed verification plan confirmed through the user's approval of the stated Autopilot scope. No new product requirements.
- Stage 3 entered at base SHA above. Implementation and final tests/reviews are not yet complete. Next: repository persistence tracer test, then service coordination and runtime/component integration.

### Stage 3 evidence and runtime design

- The runtime fact review found the shared coordinator uses fixed global worker names and cannot safely represent two tabs using different settings during active responses. The configurable path therefore owns dedicated workers per provider/tab behind stable transport contracts. It does not modify the shared coordinator or terminate another tab's workers. Existing factory entry points remain compatible.
- Added repository/service/runtime contracts, injected storage/events, deferred serialized configuration changes, per-question generation settings, an unstyled settings component/context, and configurable composition. The chat service remains the same instance throughout replacement and gates Send without resetting history.
- TDD tracer cycles observed failures before implementing persistence round-trip, startup defaults, response deferral, invalid-edit rejection, saved startup choices, repository observations, per-question generation options, Auto transport values, and chat availability gating.
- Focused run: `node --import ./scripts/typescript-test.loader.js --test tests/configuration-*.spec.js tests/chat-lifecycle.spec.js tests/llm-worker.spec.js`: 36 tests passed before the final ownership regression was added. Individual repository/service/runtime checks passed; browser two-tab storage/control test passed in real Chromium with a controlled runtime.
- Hugo 0.158.0 build passed with the existing taxonomy/term warnings. Typecheck reports the same five pre-existing diagnostics (RagStates, embedding union complexity, three ignored public imports); no new diagnostics at this point.
- Real application verification found duplicate component registration caused by an unnecessary provider side-effect import. Removed that import because Hugo registers component entry points itself. Runtime verification is being repeated; no runtime pass or final review is claimed yet.
- Doctor prerequisite check passed using `PATH=/workspace/.local/bin:$PATH PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`. Generated résumé data remains ignored.

### Verification blocker — 2026-10-28

- Latest focused check: 37 tests passed across configuration repository/service/runtime/browser, chat lifecycle, and LLM worker seams. `npm run lint` passes. The browser test was rerun after extracting the Advanced template; it passes. `git diff --check` passes. No final full-suite run or reviews are claimed.
- Real Chromium/Hugo run observed default Auto reaching both workers unchanged and becoming ready, explicit CPU readiness, a rendered CPU answer, a token-budget edit deferred until response completion, preserved history across Local/Online/Local, a visible unavailable-WebGPU failure with explicit switch-back to CPU, and a returning profile initializing directly with saved CPU settings.
- That run did not pass overall: its final two-tab real-model check crashed a browser target. It also retained the initial duplicate-registration error from before the source correction. Keep it as diagnostic evidence, not a clean runtime pass: [result](evidence/real-application-attempt.json), [server log](evidence/real-application-server.log), [runner](evidence/real-application-runner.txt). Screenshot `evidence/configuration.png` is local and ignored.
- A fresh browser repeated only the two-tab CPU scenario against corrected source. The first tab became ready; the second did not become ready within 240 seconds: [result](evidence/two-tab-attempt.json), [server log](evidence/two-tab-server.log), [runner](evidence/two-tab-runner.txt).
- The host cgroup memory limit is 8,589,934,592 bytes. During these attempts its OOM count increased from 3 to 6 and OOM kills from 3 to 5. This supports resource exhaustion as a runtime-verification limitation; it does not establish that cross-tab real-model behavior passes or rule out an application memory issue. Both owned browsers and Hugo servers exited; isolated runtime scratch directories were removed. Evidence remains.
- Stage 4 is BLOCKED on the required real-model two-tab journey. The user has been asked whether to accept controlled-runtime two-tab browser verification plus real single-tab inference, with the two-real-model case explicitly recorded as blocked. That alternative is not yet approved. Do not close this ticket, run final publication, or claim readiness until approval or a successful real two-tab run resolves the gate. Once resolved, repeat runtime checks against stable source, create a signed snapshot, then run both reviews and the remaining workflow stages.

### User correction: shared runtime ownership

- The user explicitly rejected the independent per-tab runtime on 2026-10-28: opening a second tab must not load another model; requests go to the tab hosting the live bot through the SharedWorker and responses return to the requesting tab.
- The dedicated-worker-per-tab design above is rejected, not an accepted verification limitation. Do not request a waiver for multiple-model memory use. The configuration repository and UI work can be reused, but the runtime/composition path and tests that assume independent tab models must be revised.
- Inspection confirms `state-machine.shared-worker.ts` explicitly intends one live instance. Its current `transfer` branch only posts back to the passed port, while the caller loops over every port; it is not yet a targeted owner/request router. `Hub.send()` currently posts to the tab's local hub connection. Extend the existing shared routing and ownership mechanism instead of bypassing it.
- Return to Stage 1 for the corrected runtime interface and shared reconfiguration semantics. Existing runtime results, code reviews, blast-radius review, and final test result cannot pass the corrected specification. No source snapshot is committed or published. Next: confirm the global idle/reconfiguration rule, then implement and test cross-tab owner routing with one model initialization.

- The user confirmed the corrected design (“Ok lets go”): model/backend/precision replacements wait for active responses across tabs to finish; opening a second tab does not reload anything. Resume Stage 3 with one owner tab, SharedWorker routing, client/request isolation, and a global idle barrier. Keep real two-tab verification required; the prior waiver request is withdrawn.
- Owner lifetime policy: use an exclusive browser ownership lock, not a background-tab heartbeat timeout, before constructing an owner runtime. Release its workers before releasing ownership. A new lock holder can claim ownership after a tab closes; interrupted requests fail visibly and are never replayed automatically. This is ownership fencing, not an alternative Auto/backend-selection policy.

### Corrected implementation and Stage 4 verification

- Stage 3 completed with the shared-owner design. The existing SharedWorker now registers clients, routes whole RAG transactions to the exclusive owner, routes replies only to their requesting tab, closes admission for pending settings, waits through retrieval/prompt construction/generation/cancellation acknowledgment, coalesces settings, and rejects stale owner epochs or initialization revisions. Only the lock holder constructs model workers. Conversation state remains per tab.
- The LLM worker now acknowledges cancellation after generation actually stops. An explicit request-terminal notification covers local retrieval/prompt failures and cancellation, so settings replacement cannot run between retrieval and generation.
- Corrected a startup-order defect found by a failing regression: an owner claim must retain selected settings when configuration arrives first. Also removed misleading “after this response” feedback after settings have failed. Controlled Chromium startup-failure verification passes.
- Latest focused command: `node --import ./scripts/typescript-test.loader.js --test tests/configuration-*.spec.js tests/shared-configuration-*.spec.js tests/chat-lifecycle.spec.js tests/llm-worker.spec.js` — **45 passed, 0 failed**. See [focused output](evidence/focused-tests.log). Full lint passes. Hugo build passes with the existing taxonomy/term warnings. [Typecheck output](evidence/typecheck.log) retains exactly the five baseline diagnostics; no new type errors. `git diff --check` passes.
- **Real two-tab CPU PASS:** one generation and one retrieval initialization in the first tab; zero in the second. Both tabs submitted questions through that owner, completed separate responses, adopted a token-budget change, and retained separate conversations. Initialization counts remained `[2, 0]` after the generation-only change. See [result](evidence/shared-two-tab-pass.json), [server log](evidence/shared-two-tab-server.log), and [runner](evidence/shared-two-tab-runner.txt).
- **Real settings journey PASS:** clean Auto startup passed `auto` literally to both pipelines; CPU selection loaded; a mid-response token edit waited; Local/Online/Local preserved history; unavailable WebGPU showed the failed combination and explicit switch-back restored CPU; reload started directly with saved CPU settings; another tab adopted Online. See [result](evidence/shared-configuration-pass.json), [server log](evidence/shared-configuration-server.log), and [runner](evidence/shared-configuration-runner.txt).
- **Real saved-WebGPU startup failure PASS:** requested settings and the GPU diagnostic were visible, Restore defaults was offered, and Send remained unavailable. See [result](evidence/saved-gpu-startup-pass.json). WebGPU success is not claimed on this host. Model factual accuracy remains outside scope; successful transport/rendering does not establish answer accuracy.
- Both real-run helpers closed their owned browsers/Hugo servers, removed their isolated scratch directories, and retained evidence. No generated index or PNG is tracked. The earlier independent-runtime memory blocker is superseded by the passing shared-runtime test; no verification waiver is used.
- Stage 4 cleanup removed the unnecessary component side-effect import, clarified failure recovery text, separated Advanced/status rendering, and removed unused imports. No `any` casts, unrelated formatting edits, or new styling were added. Runtime source changes after the real positive journeys were limited to the startup selection metadata regression and error/status presentation; those affected paths passed real GPU-startup and controlled browser checks.
- Next: create the signed implementation snapshot, run independent Standards and Spec reviews, then blast-radius and final full-suite/publication stages. Reviews and final full-suite evidence are not yet complete.

- Signed implementation snapshot: `3089d38aea180ac567d55680586a00bf7cd3f65a`; SSH signature verified. Stage 5 entry uses this implementation and the fixed base above. Initial staged whitespace checking also found trailing spaces in captured Hugo console tables; only those log trailing spaces are normalized in the following evidence-record commit. No runtime source is changed by that normalization. Standards/Spec reviews remain pending; final suite has not run yet.

### Review-fix pass

- Reviewed head `e9d2baa776f84e40f7bd44b0e9017f250bb0781d`: Standards found 0 issues. Spec found P1 anonymous worker crashes being dropped, P2 readiness hiding interrupted-response Retry, P2 failover settings errors not reaching the service after apply completion, and P3 owner progress no longer reaching the existing bars.
- Returned to Stage 3. Both previous review results, blast-radius review, and final test result are invalidated for the fixes; none may be reused as a final pass.
- Added failing regressions before the fixes. Anonymous owner failures now fail outstanding requests, release the idle barrier, stop the failed owned runtime, and publish configuration errors. Ongoing shared-runtime availability is a service subscription, not only an apply promise. Response errors survive readiness updates until explicit Retry/Reset, and Retry cannot send while runtime availability is blocked. Owner progress is injected back into the existing BroadcastChannel presentation path.
- Controlled real-browser coverage includes an actual Worker exception, visible settings diagnostics after startup, explicit settings Retry without automatically retrying the failed question, and preserved interrupted-response state. Repeated real-model checks and final reviews are in progress; no final pass is claimed yet.
- After the 2026-10-29 workspace restart, repository source/commits/evidence survived, but temporary runners and results did not. Restored runners from tracked evidence. No earlier passing result is presented as a result for unverified review fixes.

- All four Spec findings now have fixes and passing focused regressions. The controlled browser test throws an actual Worker exception and confirms settings diagnostics, explicit recovery, no automatic question retry, and retained response errors. Node checks cover barrier release and progress forwarding.
- **Repeated real settings/lifecycle PASS after fixes:** Auto, explicit CPU, two existing progress bars, deferred edits, preserved history, unavailable-WebGPU switch-back, Cancel retaining Retry after a settings change, Retry keeping four messages, Reset keeping zero messages after late callbacks, returning saved CPU settings, and cross-tab Online propagation. See [result](evidence/review-fix-configuration-pass.json) and [runner](evidence/review-fix-configuration-runner.txt).
- **Repeated real two-tab CPU PASS after fixes:** first-tab initialization count 2, second-tab count 0; both questions completed with separate histories; generation-only edits left counts `[2, 0]`. See [result](evidence/review-fix-two-tab-pass.json) and [runner](evidence/review-fix-two-tab-runner.txt). Both run helpers stopped their owned browsers/servers and removed their scratch directories.
- Added the reusable [shared-bot explanation](../../docs/architecture/assistant-configuration.md). The earlier local-only lifecycle explanation is unrelated and remains untracked.
- Review-fix cleanup retains the existing progress presentation path, uses one shared runtime-availability contract, preserves explicit response recovery, and lets browser tests use either the installed Chromium or Puppeteer's bundled browser. No new styling or online inference was added. Next: sign this snapshot and repeat both reviews. Final suite and publication remain pending.

- Review-fix Stage 3–4 checks completed: **48 focused tests passed**, lint passed, Hugo passed with the two existing warnings, whitespace checking passed, and typecheck retains only the same five baseline diagnostics. The repeated two-tab real-model run is PASS and both owned runtime helpers completed cleanup. The new signed fix snapshot is ready for repeated Standards/Spec review; no final suite or push has happened yet.
