# 2. Share assistant resources through RuntimeCoordinator and two model SharedWorkers

Date: 2026-11-03

## Status

Accepted. Architecture agreed with the user on 2026-11-01; implementation authorized through PR handoff on 2026-11-03.

## Context

The dedicated hub and separate ownership-state worker could leave a joining tab waiting, retain departed claims and lose errors. Per-tab model ownership made tab departure and resource reuse difficult. The assistant must share expensive model instances while keeping conversation history and business orchestration in each tab. Browser caching must also survive a new browser session where supported.

## Decision

Use three application SharedWorkers: RuntimeCoordinator owns runtime state and routing; generation owns the language-model pipeline; retrieval owns the embedding pipeline and HNSW index. Tabs create and retain all three browser connections and transfer model ports to RuntimeCoordinator. Preserve SharedWorkerManager as generic transport, and retain StandardCommunication, Chat and DB as virtual-channel interfaces.

Keep résumé retrieval, context/prompt construction, generation orchestration and history in RagService. Use client/request identities, resource epochs, FIFO generation, confirmed-stop cancellation, explicit departure signals and bounded operation deadlines. Use neither Web Locks nor heartbeats. Reconnect is explicit, preserves history and healthy resources, and never resends an interrupted question. Drain full accepted-response leases before configuration changes. Retain the model framework's browser cache.

## Consequences

Models can outlive an individual tab, but browsers can terminate their processes and evict cached downloads. SharedWorker availability and browser storage partitioning limit the sharing context. Unsupported connections fail visibly rather than starting a per-tab model fallback.

Tab composition is required because the tested SharedWorker environment lacks the dedicated Worker constructor. Recovery must retain native worker references, release failed references across tabs and reject stale replies. A timeout quarantines uncertain model work; it does not authorize overlapping inference. A worker that remains unresponsive can remain unavailable after bounded recovery.

The old ownership protocol and its exclusive consumers are removed. Generic communication facilities remain where useful. [The runtime explanation](../runtime-coordinator.md) records responsibilities, lifecycle policy, cache limits and reproducible verification. Configuration controls and preference persistence remain separate work.
