# Introduce three SharedWorkers with RuntimeCoordinator lifecycle and recovery

- STATUS: OPEN
- PRIORITY: 300
- TAGS: task, refactor

## Background

On 2026-11-01, the user selected a three-SharedWorker architecture and requested folding the runtime lifecycle and recovery work from ticket 20261029-193941 into this ticket, removing that separate ticket and excluding Web Locks. This replaces the earlier hub-removal and owner-tab election plan. This is a planning update; production implementation has not started.

One RuntimeCoordinator SharedWorker owns runtime state and request routing. One generation SharedWorker holds the language model; one retrieval SharedWorker holds the embedding model and vector index. Tabs share these resources within the supported same-origin browser context. No tab owns the model runtime, and switching tabs does not transfer a lock or reload models. Web Locks and heartbeat mechanisms are outside this scope.

RagService retains per-tab conversation history and the retrieval, context/prompt construction and generation business flow. RuntimeCoordinator manages resource readiness, progress, request lifecycle and recovery. Model workers report their actual initialization, readiness, execution and failure state. Browser model caching uses the model framework's existing support; cached weights and live in-memory model instances have different lifetimes.

Rename Hub to RuntimeCoordinator, HubAbstract to RuntimeCoordinatorAbstract and HubConnection to RuntimeCoordinatorConnection. Follow the existing file conventions with runtime-coordinator.data.ts, runtime-coordinator.abstract.ts, runtime-coordinator.connection.ts and runtime-coordinator.shared-worker.ts. Preserve and adapt StandardCommunication, its base, Chat and DB where their consumers still need them. Whether SharedWorkerManager remains a separate dependency or folds into RuntimeCoordinatorConnection is still open; audit WorkerBase consumers before removing any shared abstraction.

Following the user's prioritization request, schedule [production build and CI](../20261029-195034/TASK.md) (priority 500), then [application verification infrastructure](../20261027-104746/TASK.md) (400), this combined refactor (300), and [assistant configuration](../20261028-123834/TASK.md) (100). The supporting tickets establish checks against the current implementation; this refactor updates and passes their three-SharedWorker migration scenarios. Configuration UI and persistence remain separate work.

### Baseline and investigation findings

- The original hub forwards requests to dedicated model workers and contributes readiness/progress delivery. Repeated hosting overwrites a manager reference without terminating the previous worker. The old state SharedWorker can leave a second tab initializing, retain a departed tab's BUSY claim, route competing claims incorrectly, and reject READY. Its set/transfer operations had no application callers in the initial audit. Preserve meaningful regression scenarios while retiring that ownership protocol.
- The historical configuration branch, snapshot 06dab29ef08b28ddab9e8e7b7817011a40c1a2dd ([PR #15](https://github.com/ragemous3/personal-webpage/pull/15)), is reference material. Per-tab model loading caused memory pressure; a later parallel transport path introduced dropped errors, lost progress and stale readiness problems. Its successful checks do not verify this refactor, and merging it is not required.
- Native Chromium prototypes ran generation and embedding in three SharedWorkers, preserved loaded models after one tab closed, and reused model caches after a full browser restart with model downloads blocked. Cache persistence was not granted, so browser eviction remains possible. This did not prove whole-site offline availability or WebGPU inference.
- The tested SharedWorker environment did not expose the Worker constructor. The prototype creates/connects the three SharedWorkers from tab composition and transfers model ports to the coordinator. Duplicate registration must be safe when multiple tabs attach simultaneously.
- Real CPU cancellation required an event-loop task yield between generation steps in the prototype. Cancellation took about half a second in that probe; small timing samples did not establish a general performance guarantee. Later probes found chunks arriving after cancellation and delayed queued-cancellation acknowledgments. These remain production requirements to resolve, not completed fixes.
- Controlled worker-failure probes found stale coordinator readiness and requests accumulating after a model worker stopped. Replacing a model connection alone did not repair the prototype. Recovery must replace stale connections and reject obsolete replies while retaining healthy resources where possible.
- Exploratory runners and evidence currently exist only in the investigation workspace. They are not durable production verification. The verification ticket must retain reproducible runners and small evidence, or rerun the probes if those temporary artifacts are unavailable, before relying on their findings for closure. The old always-UNINITIALIZED browser fixture cannot prove real shared-worker behavior.

**What to build:** let multiple tabs use one shared Offline assistant runtime, with isolated conversations, cancellation and explicit recovery after failure.

**Demo path:** open two tabs together, obtain separate answers without duplicate model initialization, cancel one request, close its tab and continue in the other. Stop a worker, reconnect without losing the conversation or replaying the interrupted question, then restart the browser and demonstrate cached-model reuse.

Keep this as the combined runtime ticket requested by the user. Work through the complete multi-tab answer path, cancellation/departure path, and failure/reconnect path as verification checkpoints within this ticket; do not split it into transport, state-machine and model-worker layer tickets. Its remaining design gates below must be settled before implementation. Ticket preparation does not claim that this entire refactor fits one uninterrupted session.

Planning publication: branch `docs/20261101-runtime-tickets-skills`, fixed base `1f2efdd54c68a7f94726e5aee6d8db2e064baab9`. The user authorized ticket refinement, repository skill installation, signed commits, branch push and PR creation. This publishes the plan only; this implementation ticket stays OPEN.

## Prerequisites

- Refresh the caller inventory on the implementation base: hub/state consumers, check/set/transfer operations, generic entity support, readiness/progress delivery, error handling, cleanup, composition, contracts, tests and worker asset mappings. Give each superseded responsibility an explicit disposition.
- Agree remaining class boundaries, public test seams and Guided/Autopilot implementation mode before production changes. This ticket update does not select an implementation mode.
- Agree supported browsers and behavior when SharedWorker is unavailable or browser storage partitions prevent sharing. Specify failure detection and bounded request/reconnect deadlines without Web Locks or heartbeats; silent departure cannot be inferred reliably from pagehide alone.
- Prepare the supported toolchain, isolated browser contexts and browser-compatible retrieval index for real application checks. Distinguish controlled worker tests from real CPU inference and record unavailable hardware.

## Acceptance criteria

- [ ] Sequential and simultaneous tab openings share one RuntimeCoordinator, one generation and one retrieval application SharedWorker per supported sharing context. Model initialization is deduplicated; late joiners receive current readiness, progress or failure. Record any library-internal workers separately.
- [ ] Apply the agreed RuntimeCoordinator class/base/connection and file naming. Replace the old dedicated hub and separate ownership-state worker with one coordinator path. Update composition and worker asset mappings, removing obsolete paths only after the consumer audit.
- [ ] Keep RagService responsible for conversation and business orchestration. Preserve useful communication abstractions and per-tab conversation isolation. Opening, switching or closing a tab does not reload models still used by other tabs.
- [ ] Route queries, streamed/final responses, cancellation and failures by client and request identity. Generation runs one request at a time in arrival order. Repeated attachment/initialization does not leak workers, ports or subscriptions.
- [ ] Model workers report actual lifecycle state; RuntimeCoordinator maintains authoritative shared runtime state. Reject stale initialization and responses using runtime/configuration identities. Errors without request IDs reach affected services/UI, and readiness updates do not hide failures.
- [ ] Cancel queued and active work without unloading a healthy model. Distinguish cancellation receipt from completion, acknowledge stopping accurately, suppress chunks after cancellation, and ensure cancelled queued work never starts. Verify cancellation before generation and measure active cancellation latency and throughput impact against an agreed baseline.
- [ ] Explicit departure on close/navigation/refresh detaches that client and cancels its work without stopping other clients' resources. Hidden or frozen tabs retain accepted work. When departure is uncertain, accepted work may finish within the agreed bounded policy. Test navigation/back restoration and distinguish observed departure from undetectable silent loss; use neither Web Locks nor heartbeats.
- [ ] Runtime failure shows “Something went wrong” and an unstyled “reconnect” button. Reconnect preserves the tab's conversation and healthy resources where possible, repairs stale connections/readiness, and coalesces concurrent recovery attempts. Interrupted questions are not replayed automatically; requests cannot remain pending indefinitely.
- [ ] Drain the entire accepted response, including retrieval-to-generation gaps, before planned model replacement. Provide the lifecycle contract needed by the later configuration ticket; generation-only settings must not require weight reloads. Do not add configuration controls or preference persistence here.
- [ ] Preserve model-framework browser caching for both models. Verify reuse across browser sessions with model downloads blocked and report cache eviction/persistence limitations. Distinguish cached models from availability of application, WASM and retrieval assets.
- [ ] Preserve readiness, progress, Reset and per-tab response behavior, adapting failure recovery to the agreed reconnect UI. Remove obsolete tests only after their meaningful assertions cover the surviving path.

## Dependencies

**Blocked by:** [Application verification infrastructure](../20261027-104746/TASK.md), which provides the reusable runner and observed baseline; it is itself blocked by the reproducible build ticket. Production fixes and passing migration checks belong here, not in the harness ticket.

- [Shared chat lifecycle](../20261022-202009/TASK.md) and [model-worker lifecycle](../20261011-184042/TASK.md) provide baseline behavior to preserve.
- [Application verification](../20261027-104746/TASK.md) supplies reusable browser checks. This ticket retains responsibility for evidence against its own implemented revision.
- [Production build and CI](../20261029-195034/TASK.md) supplies the asset checks. Update them for the three shared-worker entry points and RuntimeCoordinator naming, verify fingerprints/module references/base paths, and remove obsolete hub/state worker entries from clean output.
- [Assistant configuration](../20261028-123834/TASK.md) follows this ticket and consumes its shared lifecycle contract. No new models, online inference or conversation persistence are introduced here.

## Definition of Done

- [ ] All acceptance criteria have evidence tied to the implemented revision. Retain commands and small evidence in the repository; keep generated indices, model caches and evidence PNGs ignored.
- [ ] Run focused protocol/lifecycle checks, native multi-tab browser checks and a real CPU application journey. Cover simultaneous attachment, isolated requests, cancellation, departure/background behavior, failed initialization, worker failure, repeated reconnect and cache reuse. Report controlled versus real-model coverage, latency measurements and remaining limitations accurately.
- [ ] Update the architecture explanation with labelled connections, layer responsibilities and verified worker counts. Record classes retained, renamed, refactored or removed, and explain intentional historical hub references.
- [ ] Complete the repository implementation flow, including relevant lint/type/build checks, deslop, runtime verification, Standards and Spec reviews, blast-radius disposition and the final full test suite after reviews. Clean up owned test processes and record baseline failures separately.
- [ ] Publish through the agreed implementation workflow after implementation mode is selected. This planning update authorizes no implementation, merge or release.

### Planning PR verification (2026-11-01)

The planning and skill changes were reviewed at signed snapshot `ffd7f460943c9aa93f9c4ab4aa932e1d5a6ae284`, against fixed base `1f2efdd54c68a7f94726e5aee6d8db2e064baab9`. Independent Standards and Spec reviews each reported zero actionable findings. The installed to-tickets skill adapts the upstream method to TATR and the already-approved four-ticket grouping; downloaded supporting files and MIT licenses match upstream revision `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`.

Checks after review: `npm test` passed 42 tests with zero failures; `npm run typecheck` and `npm run lint` exited 0. Prettier passed for authored/adapted Markdown. Local Markdown links, TATR sections, blocker order and `git diff --check` passed. Unmodified upstream files retain their original formatting. These checks cover the planning PR; no runtime implementation or three-SharedWorker production verification is claimed. No live data operations or runtime changes occur in this PR.

Next action: settle the remaining transport-class boundary, failure/departure policy and verification thresholds, then select implementation mode for the combined refactor.
