# ProgressService

[Source](../../assets/layers/services/progress.service.ts). The progress slice forwards model-initialization events from the coordinator to ProgressContainer. Online answer-token deltas use RagService, rather than this progress subscription.

Implementation: `a624a4154cdb9a530687743a8f6800bdce83c2c1`. Primary Online, settings and real Local CPU/cache journeys are verified; the supplemental forced-close limitation is recorded in the ticket. Comparison base: `df7fd5597ec6613af55ddba4506ca61ce6109e7c`. Live credentialed OpenAI access is unverified. Colors refer to this comparison.

Green borders identify added components or dependencies; yellow borders identify modified source; default borders identify unchanged or pure-moved code. Solid arrows show runtime calls/data; dotted arrows show type relationships. Composition remains disconnected. See [diagram maintenance and style](README.md).

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
  class GenerationDriver,CoordinatorBase,Connection,Hub modified;
  style GenerationWorker stroke:#bf8700,stroke-width:3px
```
