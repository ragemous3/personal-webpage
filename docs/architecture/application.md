# Application architecture

The application includes the static Hugo build, all three service slices, shared browser workers, storage and the Express/OpenAI boundary. Detailed contracts and paths are shown in [RagService](rag-service.md), [ConfigurationService](configuration-service.md) and [ProgressService](progress-service.md).

Implementation: `ac22203a9ddd0d759712d1b5a8eed6195d41a3ae`. Comparison base: `df7fd5597ec6613af55ddba4506ca61ce6109e7c` (PR #23). The code is verified with controlled Online HTTP/model fixtures and a real Local CPU/cache journey. Live credentialed OpenAI access is unverified. Colors refer to this comparison.

Green borders identify added components or dependencies; yellow borders identify modified source; default borders identify unchanged or pure-moved code. Solid arrows show runtime calls/data; dotted arrows show type relationships. Composition remains disconnected. See [diagram maintenance and style](README.md).

```mermaid
flowchart TB
  subgraph Build["Static build"]
    Content["content/"]
    Config["config/"]
    Hugo["Hugo<br/>layouts/"]
    Public["public/"]
  end
  subgraph Views["Views layer"]
    ChatUI["ChatContainer"]
    SettingsUI["AssistantConfiguration"]
    ProgressUI["ProgressContainer"]
  end
  subgraph Services["Services layer"]
    Rag["RagService"]
    Settings["ConfigurationService"]
    Progress["ProgressService"]
  end
  subgraph Shared["Shared layer — contracts"]
    RagContract["ChatbotServiceContract"]
    SettingsContract["ConfigurationServiceContract"]
    ProgressContract["ProgressServiceContract"]
    PortContract["StandardCommunicationContract"]
    RuntimeContract["RuntimeCoordinatorContract"]
    AdapterContract["RuntimeConfigurationAdapterContract"]
    CatalogContract["OnlineModelRepositoryContract"]
  end
  subgraph Data["Data layer — browser tab"]
    Chat["Chat"]
    DB["DB"]
    Standard["StandardCommunication"]
    Coordinator["RuntimeCoordinator"]
    CoordinatorBase["RuntimeCoordinatorAbstract"]
    Connection["RuntimeCoordinatorConnection"]
    Transport["SharedWorkerManager"]
    PassageRepo["ContentRepository"]
    Prompt["ChatMessageModel"]
    Preferences["ConfigurationRepository"]
    Metadata["ModelMetadataRepository"]
    Catalog["OnlineModelRepository"]
    Adapter["RuntimeConfigurationAdapter"]
    IndexStorage["IndexDBBase"]
  end
  subgraph Workers["Data layer — three SharedWorkers"]
    Hub["RuntimeCoordinatorStateMachine<br/>runtime-coordinator.shared-worker.ts"]
    Retrieval["SharedModelRuntime<br/>vectordb.shared-worker.ts"]
    Index["VectorDBHNSWData"]
    subgraph GenerationWorker["llm.shared-worker.ts"]
      GenRuntime["SharedModelRuntime"]
      GenDriver["createLlmMessageHandler"]
      GenAbstract["GenerationAbstract"]
      Local["LocalLLMData"]
      Online["OnlineGeneration"]
    end
  end
  subgraph Server["Server — Express API and provider integration"]
    ModelAPI["GET /api/models"]
    GenerateAPI["generate<br/>POST /api/generate"]
    Provider["OpenAIProvider"]
    ProviderBase["GenerationProviderAbstract"]
    SDK["OpenAI.responses.create<br/>openai"]
  end
  subgraph Resources["Storage and external resources"]
    Storage["localStorage"]
    Cache["CacheStorage"]
    IndexedDB["indexedDB"]
    Files["/content-data/chunks.json<br/>contents.bin / vector-metadata.json"]
    HF["huggingface.co"]
    OpenAI["gpt-6-luna<br/>reasoning.effort: low"]
  end
  subgraph Composition["Composition — entry-point names only"]
    ChatProvider["ChatbotOfflineProvider"]
    ChatFactory["buildChatbotOfflineDeps"]
    ProgressProvider["ProgressProvider"]
    ProgressFactory["progressFactory"]
    RuntimeFactory["getRuntimeCoordinator"]
    ServerEntry["server/main.composition.ts"]
    APIFactory["createApp"]
  end

  Content --> Hugo
  Config --> Hugo
  Hugo -->|"build"| Public
  Public -->|"load view modules"| ChatUI
  Public -->|"load view modules"| SettingsUI
  Public -->|"load view modules"| ProgressUI
  ChatUI <-->|"actions and conversation state"| Rag
  SettingsUI <-->|"edits and settings state"| Settings
  Progress -->|"progress state"| ProgressUI
  ProgressUI -->|"connect"| Progress
  ChatUI -.->|"uses"| RagContract
  Rag -.->|"implements"| RagContract
  SettingsUI -.->|"uses"| SettingsContract
  Settings -.->|"implements"| SettingsContract
  ProgressUI -.->|"uses"| ProgressContract
  Progress -.->|"implements"| ProgressContract
  Rag <-->|"generation"| Chat
  Rag <-->|"retrieval"| DB
  Rag <-->|"selected passages"| PassageRepo
  Rag <-->|"prompt and history"| Prompt
  Rag <-->|"response leases"| Coordinator
  Rag -.->|"uses"| PortContract
  Chat -.->|"extends"| Standard
  DB -.->|"extends"| Standard
  Chat <-->|"messages"| Coordinator
  DB <-->|"messages"| Coordinator
  Coordinator -->|"progress events"| Progress
  Progress -.->|"uses"| RuntimeContract
  Coordinator -.->|"extends"| CoordinatorBase
  CoordinatorBase -.->|"implements"| RuntimeContract
  Coordinator <-->|"transport"| Connection
  Connection -.->|"extends"| Transport
  Connection <-->|"MessagePort"| Hub
  Hub <-->|"retrieval"| Retrieval
  Retrieval <-->|"embed and search"| Index
  Hub <-->|"generation and confirmed stop"| GenRuntime
  GenRuntime <-->|"handle and publish"| GenDriver
  GenDriver -.->|"uses"| GenAbstract
  GenDriver -->|"Local selection"| Local
  GenDriver -->|"Online selection"| Online
  Local -.->|"extends"| GenAbstract
  Online -.->|"extends"| GenAbstract
  Local -->|"model files"| HF
  Local <-->|"cached weights"| Cache
  Index -->|"embedding model"| HF
  Index <-->|"cached embedding weights"| Cache
  Index <-->|"persist index"| IndexStorage
  IndexStorage <-->|"read and write"| IndexedDB
  Index -->|"load index assets"| Files
  PassageRepo -->|"load passages"| Files
  Settings <-->|"load, save and observe"| Preferences
  Preferences <-->|"persist preferences"| Storage
  Settings <-->|"Local options"| Metadata
  Metadata <-->|"pinned model metadata"| HF
  Metadata <-->|"cached metadata"| Cache
  Settings <-->|"Online options"| Catalog
  Catalog -.->|"implements"| CatalogContract
  Catalog <-->|"fetch choices"| ModelAPI
  Settings <-->|"apply and observe"| Adapter
  Adapter -.->|"implements"| AdapterContract
  Adapter <-->|"configure runtime"| Coordinator
  Adapter -->|"setAvailable"| Rag
  Online <-->|"HTTP stream and abort"| GenerateAPI
  GenerateAPI -->|"injected provider"| Provider
  GenerateAPI -.->|"depends on"| ProviderBase
  Provider -.->|"extends"| ProviderBase
  Provider <-->|"stream and cancellation"| SDK
  SDK <-->|"Responses API"| OpenAI

  classDef added stroke:#2da44e,stroke-width:3px;
  classDef modified stroke:#bf8700,stroke-width:3px;
  class CatalogContract,Catalog,GenAbstract,Online,ModelAPI,GenerateAPI,Provider,ProviderBase,SDK,OpenAI,ServerEntry,APIFactory added;
  class SettingsUI,Settings,Adapter,GenDriver,Local,ChatFactory modified;
  style GenerationWorker stroke:#bf8700,stroke-width:3px
```
