# Remove the hub worker and simplify worker management

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task, refactor

## Background

Remove the dedicated hub worker and simplify the application's worker-management path. The user requested a separate TATR on 2026-10-29 because the extra forwarding worker makes the application harder to understand. This is planning work; implementation has not started.

Planning branch: `docs/20261029-worker-refactor-tatrs`. Planning base: `9cbe959120ab72d56e212ea27f9405992a4d6f58` from fetched `origin/main`.

The current path is `Hub` / `HubAbstract` -> `HubConnection` -> `hub.worker.ts` -> `WebWorkerManager` -> generation/retrieval workers. The [hub worker](../../assets/layers/data/workers/hub.worker.ts) holds a map of managers and handles ping, host and query forwarding. The inspected code does no model inference or retrieval computation in the hub itself. Cross-tab coordination comes from the separate SharedWorker.

The hub also contributes to readiness and progress delivery through [HubAbstract](../../assets/layers/data/abstracts/hub.abstract.ts). Removing the thread must preserve those responsibilities where needed. Repeated hosting currently creates another manager and overwrites its map entry without first terminating the previous worker. Preserve this as a regression scenario for whatever replaces the hosting operation.

The configuration branch (`feature/20261028-123834-assistant-configuration`, snapshot `06dab29ef08b28ddab9e8e7b7817011a40c1a2dd`, [PR #15](https://github.com/ragemous3/personal-webpage/pull/15)) bypasses the hub with new runtime/transport classes but leaves the original path present. That demonstrates another topology is possible, but does not constitute a completed hub removal. Its review also found lost progress delivery and dropped worker errors. Use those lessons to preserve behavior while removing the extra thread.

Evaluate reusing [WorkerBase](../../assets/layers/data/abstracts/worker-base.abstract.ts) and [WebWorkerManager](../../assets/layers/data/workers/web-worker-manager.ts) in the owner tab, with construction supplied by composition. Model generation and retrieval remain off the main thread in their dedicated workers. Whether an ordinary `Hub` class remains useful is an open design question; the requested removal concerns the dedicated hub worker and obsolete plumbing.

## Prerequisites

- Complete the linked ownership/state-machine investigation and agree the integration order. Proposed sequence: establish and verify ownership/routing first, then remove the hub thread while preserving that contract.
- Inventory hub consumers, readiness and progress delivery, worker-error handling, lifecycle cleanup, factory validation, shared contracts, tests, generated worker-name mappings and documentation on the implementation base.
- Agree the resulting class responsibilities and test seams before changing application code. An implementation mode has not been selected for this task.

## Acceptance criteria

- [ ] Record the consumer inventory and an agreed replacement for each hub responsibility. Keep ownership policy, request routing, model work and presentation separated according to the repository layers.
- [ ] Application startup creates no hub worker. Remove `hub.worker.ts` and its obsolete connection, configuration requirements and build references; retain or adapt ordinary classes only where a documented caller still needs them.
- [ ] The owner tab manages the generation and retrieval workers through one lifecycle path with injected browser construction. Worker failure reaches services/UI, and replacement or shutdown terminates the affected workers and releases subscriptions without orphan resources.
- [ ] Joining a second tab creates no extra model workers. Requests, streamed/final responses, cancellation and errors still reach only their requesting tab, with ownership handover matching the linked state-machine task.
- [ ] Existing readiness, initialization errors, progress bars, Retry, Reset and per-tab conversation behavior remain correct. Native-browser regressions cover progress and worker faults, including errors without a request ID.
- [ ] Repeated initialization or replacement does not overwrite an active worker reference and leak the old worker. Preserve the agreed rule for draining active requests before replacement.
- [ ] Tests exercise the surviving application path. Remove or rewrite obsolete hub-only fixtures/tests after their meaningful assertions are covered; do not retain a second working stack just to keep those tests passing.
- [ ] Update the architecture explanation with labelled connections and layer order. Show which responsibilities moved and which classes were removed, and verify worker counts against the resulting diagram.

## Dependencies

- The [Web Locks/state-machine WIP](../20261029-193941/TASK.md) provides the use-case audit, ownership/routing decisions and regression contract. Its implementation is the proposed predecessor; resolve any different order explicitly during design.
- [Shared chat lifecycle](../20261022-202009/TASK.md), [model-worker lifecycle](../20261011-184042/TASK.md), and the [application verification work](../20261027-104746/TASK.md).
- Configuration-branch lessons are reference material. This task does not add configuration controls, persistence, new models or online inference, and does not require merging PR #15.

## Definition of Done

- [ ] All acceptance criteria have evidence recorded against the implemented revision.
- [ ] Record focused lifecycle tests, native-browser multi-tab checks, and a real CPU application smoke check. Confirm no hub worker is instantiated, model workers remain off the main thread, progress/error presentation works, and owned test processes are cleaned up.
- [ ] Complete the repository implementation flow, including relevant lint/type/build checks, deslop, runtime verification, Standards and Spec reviews, blast-radius disposition, and the final full test suite after reviews. Record baseline failures accurately and keep generated index data and evidence PNGs ignored.
- [ ] Check for remaining hub references and explain intentional historical references. Publish the scoped change through the repository workflow; no merge or release is part of this planning request.

Next action: use the ownership investigation to agree the class layout, integration order and verification plan for hub removal.
