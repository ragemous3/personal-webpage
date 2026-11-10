# ProgressService

[Source](../../assets/layers/services/progress.service.ts). The progress slice forwards model-initialization events from the coordinator to ProgressContainer. Online answer-token deltas use RagService, rather than this progress subscription.

Implementation: `edf9cc20dfec589ac8584efd93e55c0cfd1e26ed` (signed channel-recovery checkpoint). Failed channel hosting is retried when the same coordinator attachment recovers. Settings, real Local and controlled Online journeys pass. Native audible speech remains unverified under the approved alternative. Both independent reviews and final checks pass; see the [ticket](../../tasks/20261108-123438/TASK.md) for evidence. Comparison base: `44e79ef4695dc7e24defb50981dd16ec21cf1179`. Green borders mark additions; yellow borders mark modified source; default borders mark unchanged components. Solid arrows show runtime calls/data; dotted arrows show type relationships. Composition remains disconnected. See [the architecture skill](../../.agents/skills/architecture-mermaid/SKILL.md).

```mermaid
flowchart TB
  subgraph Views["Views layer"]
    UI["ProgressContainer"]
  end
  subgraph Services["Services layer"]
    Progress["ProgressService"]
  end
  subgraph Shared["Shared layer — contracts and models"]
    ProgressContract["ProgressServiceContract"]
    CoordinatorContract["RuntimeCoordinatorContract"]
    ProgressDTO["ProgressInfo"]
    DriverContract["SharedModelDriverContract"]
  end
  subgraph Data["Data layer — browser tab"]
    Coordinator["RuntimeCoordinator"]
    CoordinatorBase["RuntimeCoordinatorAbstract"]
    Connection["RuntimeCoordinatorConnection"]
    Transport["SharedWorkerManager"]
    WorkerBase["WorkerBase — abstract"]
  end
  subgraph Workers["Data layer — SharedWorkers"]
    Hub["RuntimeCoordinatorStateMachine<br/>runtime-coordinator.shared-worker.ts"]
    subgraph RetrievalWorker["vectordb.shared-worker.ts"]
      Retrieval["SharedModelRuntime"]
      RetrievalDriver["createRetrievalDriver"]
      Index["VectorDBHNSWData"]
    end
    subgraph GenerationWorker["llm.shared-worker.ts"]
      Generation["SharedModelRuntime"]
      GenerationDriver["createLlmMessageHandler"]
    end
  end
  subgraph Composition["Composition — entry-point names only"]
    Provider["ProgressProvider"]
    Factory["progressFactory"]
    RuntimeFactory["getRuntimeCoordinator"]
  end

  UI -->|"connect"| Progress
  Progress -->|"progress subscription updates"| UI
  UI -.->|"uses"| ProgressContract
  Progress -.->|"implements"| ProgressContract
  Progress -.->|"uses onData"| CoordinatorContract
  Progress -.->|"publishes maps of"| ProgressDTO
  Progress -->|"subscribe to runtime events"| Coordinator
  Coordinator -->|"model progress events"| Progress
  Coordinator -.->|"extends"| CoordinatorBase
  CoordinatorBase -.->|"implements"| CoordinatorContract
  Coordinator <-->|"native worker transport"| Connection
  Connection -.->|"extends"| Transport
  Transport -.->|"extends"| WorkerBase
  Connection <-->|"MessagePort"| Hub
  RetrievalDriver -.->|"returns"| DriverContract
  Generation -.->|"uses driver"| DriverContract
  Index -->|"initialization progress"| RetrievalDriver
  RetrievalDriver -->|"publish"| Retrieval
  GenerationDriver -->|"initialization progress"| Generation
  Retrieval -->|"resource progress"| Hub
  Generation -->|"resource progress"| Hub

  classDef added stroke:#2da44e,stroke-width:3px;
  classDef modified stroke:#bf8700,stroke-width:3px;
  class CoordinatorBase modified;
```
