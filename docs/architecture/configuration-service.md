# ConfigurationService

[Source](../../assets/layers/services/configuration.service.ts). The settings slice restores preferences, discovers Local/Online model choices, and changes the shared runtime after accepted responses drain. Its repositories keep preferences, local metadata caching and API catalog access separate.

Implementation: `f5ceddb05456b4fa696fa2dddf954ca28c9c66e2`. Primary Online, settings and real Local CPU/cache journeys are verified; the supplemental forced-close limitation is recorded in the ticket. Comparison base: `df7fd5597ec6613af55ddba4506ca61ce6109e7c`. Live credentialed OpenAI access is unverified. Colors refer to this comparison.

Green borders identify added components or dependencies; yellow borders identify modified source; default borders identify unchanged or pure-moved code. Solid arrows show runtime calls/data; dotted arrows show type relationships. Composition remains disconnected. See [diagram maintenance and style](README.md).

```mermaid
flowchart TB
  subgraph Views["Views layer"]
    UI["AssistantConfiguration"]
    Host["ChatbotHost"]
  end
  subgraph Services["Services layer"]
    Settings["ConfigurationService"]
    Rag["RagService"]
  end
  subgraph Shared["Shared layer — contracts and models"]
    ServiceContract["ConfigurationServiceContract"]
    SettingsContract["ConfigurationRepositoryContract"]
    MetadataContract["ModelMetadataRepositoryContract"]
    OnlineContract["OnlineModelRepositoryContract"]
    OnlineDTO["OnlineModel"]
    AdapterContract["RuntimeConfigurationAdapterContract"]
    SettingsDTO["AssistantSettings"]
  end
  subgraph Data["Data layer"]
    Saved["ConfigurationRepository"]
    Metadata["ModelMetadataRepository"]
    Catalogue["OnlineModelRepository"]
    Adapter["RuntimeConfigurationAdapter"]
    Coordinator["RuntimeCoordinator"]
    CoordinatorBase["RuntimeCoordinatorAbstract"]
    Connection["RuntimeCoordinatorConnection"]
    Transport["SharedWorkerManager"]
    WorkerBase["WorkerBase — abstract"]
    DB["DB"]
  end
  subgraph Workers["Data layer — SharedWorkers"]
    Hub["RuntimeCoordinatorStateMachine<br/>runtime-coordinator.shared-worker.ts"]
    subgraph GenerationWorker["llm.shared-worker.ts"]
      Llm["SharedModelRuntime"]
    end
    Vdb["SharedModelRuntime<br/>vectordb.shared-worker.ts"]
  end
  subgraph Server["Server — Express API"]
    API["GET /api/models<br/>server/app.factory.ts"]
  end
  subgraph Resources["Storage and external metadata"]
    Storage["localStorage"]
    HF["huggingface.co/api/models<br/>pinned revision"]
    Cache["CacheStorage<br/>assistant-model-metadata-v1"]
  end
  subgraph Composition["Composition — entry-point names only"]
    BrowserProvider["ChatbotProvider"]
    BrowserFactory["buildChatbotDeps"]
    LocalComposition["ChatbotOfflineProvider / buildChatbotOfflineDeps"]
    OnlineComposition["ChatbotOnlineProvider / buildChatbotOnlineDeps"]
    ModeBase["ChatbotModeProviderAbstract"]
    ServerComposition["server/main.composition.ts"]
    AppFactory["createApp"]
  end

  UI <-->|"edits and state subscription"| Settings
  Host <-->|"mounted mode after response/write drain"| Settings
  Host -.->|"uses"| ServiceContract
  UI -.->|"uses"| ServiceContract
  Settings -.->|"implements"| ServiceContract
  Settings -.->|"uses"| SettingsContract
  Settings -.->|"uses"| MetadataContract
  Settings -.->|"uses"| OnlineContract
  Settings -.->|"uses"| AdapterContract
  Settings <-->|"load, save and observe preferences"| Saved
  Settings <-->|"Local model options"| Metadata
  Settings <-->|"Online model options"| Catalogue
  Settings <-->|"selected and active settings"| Adapter
  Saved -.->|"implements"| SettingsContract
  Metadata -.->|"implements"| MetadataContract
  Catalogue -.->|"implements"| OnlineContract
  Adapter -.->|"implements"| AdapterContract
  Saved <-->|"persist and observe"| Storage
  Metadata <-->|"fetch matching revision"| HF
  Metadata <-->|"cache validated metadata"| Cache
  Catalogue <-->|"fetch allowed choices"| API
  Adapter <-->|"configure and observe"| Coordinator
  Adapter -->|"setAvailable"| Rag
  Adapter -->|"host shared retrieval once"| DB
  Coordinator <-->|"transport"| Connection
  Connection -.->|"extends"| Transport
  Transport -.->|"extends"| WorkerBase
  Connection <-->|"configuration and runtime state"| Hub
  Hub <-->|"configure Local generation"| Llm
  Hub <-->|"configure retrieval"| Vdb
  Coordinator -.->|"extends"| CoordinatorBase
  Catalogue -.->|"uses"| OnlineDTO
  API -.->|"uses"| OnlineDTO

  classDef added stroke:#2da44e,stroke-width:3px;
  class Host,Catalogue,OnlineContract,OnlineDTO,API,ServerComposition,AppFactory,BrowserProvider,BrowserFactory,OnlineComposition,ModeBase added;

  Settings -.->|"uses"| SettingsDTO
  Adapter -.->|"uses"| SettingsDTO
  classDef modified stroke:#bf8700,stroke-width:3px;
  class UI,Settings,Rag,Adapter,SettingsDTO,CoordinatorBase,Connection,Hub,LocalComposition modified;
  style GenerationWorker stroke:#bf8700,stroke-width:3px
```
