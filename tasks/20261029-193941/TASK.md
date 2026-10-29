# Refactor bot ownership to Web Locks after auditing state-machine uses

- STATUS: OPEN
- PRIORITY: 200
- TAGS: task, refactor, wip

## Background

WIP: investigate and refine the design before implementation. The user requested this separate refactor on 2026-10-29 after reviewing the scope growth in the assistant configuration branch. The immediate deliverable is a durable record of findings and open decisions. The criteria below describe proposed future work; they are not a completed design or an instruction to start implementation.

User-confirmed order on 2026-10-29: [hub removal](../20261029-193942/TASK.md) first (priority 300), this state-machine/Web Locks refactor second (priority 200), and [configuration](../20261028-123834/TASK.md) third (priority 100). Keep this ticket WIP while its design is unresolved.

The configuration feature grew into a replacement worker-management and routing path. Ownership and verification should have been addressed as an explicit refactor first. Move exclusive bot ownership from the existing state machine's manual claims to the browser Web Locks API, after investigating every other use of the state-machine logic.

Web Locks controls who may host the bot. It does not supply loading status, readiness, progress, request routing, or configuration state. Decide which of those responsibilities remain in the existing SharedWorker and expose one authoritative ownership/loading model. Keep the stateful subscription utilities used by services and views distinct from the worker ownership protocol.

Planning branch: `docs/20261029-worker-refactor-tatrs`. Planning base: `9cbe959120ab72d56e212ea27f9405992a4d6f58` from fetched `origin/main`. Historical configuration branch: `feature/20261028-123834-assistant-configuration`, snapshot `06dab29ef08b28ddab9e8e7b7817011a40c1a2dd`, [PR #15](https://github.com/ragemous3/personal-webpage/pull/15). That branch is a source of lessons and evidence, not the base of this planning branch. Its ticket was closed through the publication workflow; that does not mean its architecture is accepted for reuse here.

### Findings from the original state system

The 2026-10-29 investigation compared the original code at the planning base with the configuration branch. It ran the original SharedWorker in Chromium with controlled generation and retrieval workers. These checks establish lifecycle and communication behavior, not actual model execution:

| Check | Observed result |
| --- | --- |
| First tab opens and submits a question | One generation worker and one retrieval worker initialize; the owner receives an answer. |
| Second tab opens | No extra model workers initialize, but the follower stays at `initializing`. |
| Owner closes while the follower remains open | The follower still sees the departed owner's `BUSY` claim and does not take over. |
| Two ports connect before the later port makes the first claim | In a deterministic protocol probe, the initialization response goes to the earlier port with the later client's ID; the claimant receives `BUSY`. Existing ID filters leave neither client initializing. |
| A client sends `transfer` | The original handler broadcasts the message to both ports; it does not select an owner or requester. |
| A client tries to publish `READY` | The original state guard rejects it; only `UNINITIALIZED` and `BUSY` are supported. |

The [state tracker](../../assets/layers/data/workers/state-machine.shared-worker.ts) already intends to prevent duplicate loading. It checks and changes state inside a loop over receiving ports, which explains the claim-order defect. Its claim persists without owner-loss recovery. The [transport](../../assets/layers/data/abstracts/standard-communication.abstract.ts) sends questions to its local hub and filters responses by client identity. Preventing a second initialization does not, by itself, give the second tab a working request path.

An initial source scan at the planning base found `Hub`/`HubAbstract`, `Chat` and `DB` through `StandardCommunication`, their composition factories, and tests using the state-machine connection. `checkAvailability` sends `check`; no application caller sending `set` or `transfer` was found in that scan. The worker still accepts those operations. The [README](../../README.md) describes the SharedWorker as preventing reloads when another tab opens. Complete the inventory below before removing or narrowing any behavior, including generic contracts or callers outside this initial scan.

### Lessons from the configuration branch

- The first implementation attempted separate model runtimes per tab. It conflicted with the intended sharing and encountered memory pressure/OOM and failed browser checks. Opening a tab must not imply another model initialization. The recorded `240000 ms` failure was a browser-test deadline, not an application ownership timeout.
- The corrected implementation reused the existing generation, retrieval and SharedWorker scripts, but added `SharedBotCoordinator`, `SharedConfigurationRuntime`, `SharedTransport`, `OwnedBotRuntime` and `RuntimeTransport`. It bypassed the old hub/worker-manager path and retained it alongside the new path. New assistant messages bypass the original status tracker inside the same SharedWorker. Reusing the worker file is not the same as evolving its existing coordination model.
- The reusable `WorkerBase`, `WebWorkerManager` and connection abstractions deserve evaluation before another worker-management path is introduced. Do not choose a class layout solely to preserve names; record which responsibilities are retained, moved or removed.
- Model replacement must wait for the entire accepted response: retrieval, prompt construction and generation. Cancellation must be acknowledged after generation stops. Track configuration versions and owner generations so stale readiness or replies cannot install obsolete state.
- Review found dropped worker errors without request IDs, readiness updates hiding response errors/Retry, failure state disappearing after an apply promise settled, and disconnected loading-progress bars. Those defects were fixed on the configuration branch. Preserve their regression scenarios when designing the refactor.
- Model/backend/precision changes may require worker replacement. Generation-only changes should not reload weights. Configuration changes must not erase a tab's conversation or silently replay an interrupted question. The configuration UI and persistence feature remain separate work.

The [historical configuration ticket](https://github.com/ragemous3/personal-webpage/blob/06dab29ef08b28ddab9e8e7b7817011a40c1a2dd/tasks/20261028-123834/TASK.md) records the attempts, review fixes and final checks. Its [real CPU two-tab evidence](https://github.com/ragemous3/personal-webpage/blob/06dab29ef08b28ddab9e8e7b7817011a40c1a2dd/tasks/20261028-123834/evidence/review-fix-two-tab-pass.json) reports two owner worker initializations, zero follower initializations, separate answers, and no reload for generation-only edits. This is evidence for that implementation, not proof of this proposed refactor.

### Verification lessons

The old [SharedWorker fixture](../../tests/browser-workers.fixture.js) always returns `UNINITIALIZED`. It cannot reveal competing claims, follower attachment, stale ownership, or genuine shared-port routing. A module singleton also proves reuse only within one tab's JavaScript context.

On 2026-10-29, the configuration snapshot passed 19 focused tests with `node --import ./scripts/typescript-test.loader.js --test tests/shared-configuration-runtime.spec.js tests/shared-configuration-browser.spec.js tests/offline-singletons.spec.js tests/offline-config.spec.js tests/chat-transport.spec.js`. This included native Chromium workers, SharedWorker and Web Locks with controlled model responses. Some of these files exist only on the configuration branch. The old-browser probe still reproduced the failures listed above. Passing tests did not establish that the old path supported multiple usable tabs.

Build a repeatable test seam before restructuring production code. Keep protocol tests, browser coordination tests and real CPU model checks separate, and record what each proves. Count live workers as well as initialization requests. Persist commands and small evidence in the ticket; temporary runners disappeared during an earlier environment restart. Keep generated browser-compatible HNSW data and evidence PNGs ignored. Native hnswlib indices are not a substitute for this browser index. Record unavailable WebGPU and existing type-check diagnostics honestly.

## Prerequisites

- Complete hub removal first and use its resulting worker-management path and verification baseline. Investigate other state-machine use cases before implementing this second refactor.
- Finish the use-case audit and discuss its findings before selecting the final ownership/state design. No Guided/Autopilot implementation mode has been selected for this WIP.
- Inventory production callers, entity names, message operations, shared contracts, readiness/progress consumers, cleanup paths, tests, and worker-build configuration on the chosen implementation base. Compare the configuration branch separately. Establish whether any non-bot resource relies on the old protocol.
- Agree browser support and behavior when Web Locks or SharedWorker is unavailable, when a tab is suspended, and when browser profiles or storage partitions differ. A closed/crashed owner releases its lock; a suspended or hung owner may keep it. Do not silently steal ownership and create a second bot.
- Install the project toolchain and prepare isolated Chromium contexts. Use compatible Hugo and browser-generated retrieval data for real CPU checks. Agree reproducible commands before implementation.

## Acceptance criteria

- [ ] Record the completed state-machine use-case/caller inventory, including a disposition for `check`, `set`, `transfer`, generic entity support and each loading/progress consumer. Investigate other use cases before removing ownership logic.
- [ ] Agree and document the ownership/state boundaries and verification plan. Web Locks replaces manual exclusive-ownership claims; readiness, progress, routing and failures remain explicitly represented. Record which existing classes can be adapted and why any new abstraction is needed.
- [ ] Add meaningful regression coverage for the observed claim-order, follower-readiness and stale-owner failures before the refactor. Use the real coordination code; the browser suite uses native SharedWorker, MessagePort and Web Locks with controlled model workers.
- [ ] Within the supported same-origin browser context, simultaneous and sequential tab openings create one owner and at most one active generation/retrieval worker pair. Joining followers create no model workers and receive current readiness or failure state.
- [ ] The existing SharedWorker routes follower requests, streaming/final responses, cancellation and failures to the correct client/request. Tab conversations stay independent, and a follower's cleanup cannot stop another tab's workers.
- [ ] Normal owner shutdown stops owned workers before releasing the lock. After owner close or a tested crash, a waiting tab can acquire ownership and initialize a replacement. Interrupted requests fail visibly and are not replayed automatically; stale-owner replies cannot affect the new owner.
- [ ] The agreed behavior for unsupported APIs, background/suspended tabs, failed initialization and repeated recovery is tested or recorded as a specific remaining limitation. Lock acquisition does not imply model readiness or transfer an in-memory model.
- [ ] The lifecycle offers a verified way to drain accepted work before worker replacement, including retrieval-to-generation gaps and cancellation acknowledgment. If configuration integration is deferred, record and test the lifecycle contract without importing the configuration UI or storage feature.
- [ ] Remove superseded ownership logic only after every inventoried use has a disposition. Retain one authoritative coordination path and avoid another parallel implementation.

## Dependencies

- [Shared chat lifecycle](../20261022-202009/TASK.md) and [model-worker lifecycle](../20261011-184042/TASK.md) provide the baseline behavior to preserve.
- [Application verification work](../20261027-104746/TASK.md) overlaps the test tooling. Reassess its recorded limitations against the implementation base; do not reopen or close it as a side effect of this task.
- The configuration branch and PR #15 provide historical evidence and candidate regression scenarios. Merging or cherry-picking that feature is not a prerequisite.
- [Remove the hub worker](../20261029-193942/TASK.md) is the preceding task. Refresh the caller inventory after it lands. [Configuration](../20261028-123834/TASK.md) is the following task and must integrate with the resulting lifecycle contract.

## Definition of Done

- [ ] All acceptance criteria have evidence, tied to the implemented revision. Retire the `wip` tag only after the design is agreed; keep the task OPEN until the implementation workflow is complete.
- [ ] Record focused protocol checks, native multi-tab browser checks, and a real CPU two-tab application journey with explicit worker counts, request isolation and cleanup. Distinguish controlled outputs from real inference; generated text alone does not prove factual accuracy.
- [ ] Complete the repository implementation flow: relevant lint/type/build checks, deslop, runtime verification, Standards and Spec reviews, blast-radius disposition, and the final full suite after reviews. Record existing baseline failures separately. Do not wait for CI unless the user changes that instruction.
- [ ] Update the architecture explanation with labelled connections and the verified ownership/loading responsibilities. Link the configuration follow-up and hub-removal task without absorbing their implementation scope.

Next action: after hub removal, complete the state-machine use-case audit, discuss the open decisions, and refine this WIP into an agreed refactor and verification plan.
