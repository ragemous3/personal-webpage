# RagService

[Source](../../assets/layers/services/chatbot.service.ts). The answering slice reuses browser retrieval and history for Local or Online generation. Streamed output and cancellation return through the coordinator; the API uses OpenAI only for generation.

Implementation: `ac22203a9ddd0d759712d1b5a8eed6195d41a3ae`. Comparison base: `df7fd5597ec6613af55ddba4506ca61ce6109e7c` (PR #23). The code is verified with controlled Online HTTP/model fixtures and a real Local CPU/cache journey. Live credentialed OpenAI access is unverified. Colors refer to this comparison.

Green borders identify added components or dependencies; yellow borders identify modified source; default borders identify unchanged or pure-moved code. Solid arrows show runtime calls/data; dotted arrows show type relationships. Composition remains disconnected. See [diagram maintenance and style](README.md).

```mermaid
flowchart TB
  subgraph Views["Views layer — browser tab"]
    UI["ChatContainer"]
  end
  subgraph Services["Services layer — browser tab"]
    Rag["RagService<br/>retrieval, history and response lifecycle"]
  end
  subgraph Contracts["Shared layer — contracts"]
    ChatServiceContract["ChatbotServiceContract"]
    PortContract["StandardCommunicationContract<br/>alias of StandardCommunicationBaseContract"]
    LifecycleContract["RuntimeLifecycleContract"]
    CoordinatorContract["RuntimeCoordinatorContract"]
    ContentContract["ContentRepositoryContract"]
    DriverContract["SharedModelDriverContract"]
  end
  subgraph Data["Data layer — browser tab"]
    Chat["Chat"]
    DB["DB"]
    Standard["StandardCommunication<br/>abstract"]
    StandardBase["StandardCommunicationBaseAbstract"]
    Content["ContentRepository"]
    Prompt["ChatMessageModel<br/>history and retrieved-context prompt"]
    PromptContract["ChatMessageModelContract"]
    Coordinator["RuntimeCoordinator"]
    CoordinatorBase["RuntimeCoordinatorAbstract"]
    Connection["RuntimeCoordinatorConnection"]
    Transport["SharedWorkerManager"]
  end
  subgraph Workers["Data layer — three SharedWorkers"]
    Hub["RuntimeCoordinatorStateMachine<br/>runtime-coordinator.shared-worker.ts"]
    Retrieval["SharedModelRuntime<br/>createRetrievalDriver<br/>vectordb.shared-worker.ts"]
    Index["VectorDBHNSWData<br/>embedding pipeline and index"]
    subgraph GenerationWorker["llm.shared-worker.ts"]
      GenerationRuntime["SharedModelRuntime"]
      GenerationFactory["createLlmDriver"]
      Generation["createLlmMessageHandler"]
      GenerationBase["GenerationAbstract"]
      Local["LocalLLMData"]
      Online["OnlineGeneration"]
    end
  end
  subgraph Server["Server — Express API and provider integration"]
    API["generate<br/>POST /api/generate<br/>server/app.factory.ts"]
    RequestDTO["GenerationRequest"]
    Instructions["assistantInstructions"]
    ProviderBase["GenerationProviderAbstract"]
    Provider["OpenAIProvider"]
    SDK["OpenAI.responses.create<br/>openai"]
  end
  subgraph Resources["Content and external resources"]
    Chunks["/content-data/chunks.json"]
    LocalWeights["Xenova/Qwen1.5-0.5B-Chat<br/>browser model cache"]
    RetrievalAssets["Xenova/all-MiniLM-L6-v2<br/>contents.bin / vector-metadata.json"]
    OpenAI["gpt-6-luna<br/>reasoning.effort: low"]
  end
  subgraph Composition["Composition — entry-point names only"]
    BrowserProvider["ChatbotOfflineProvider"]
    BrowserFactory["buildChatbotOfflineDeps"]
    ServerComposition["server/main.composition.ts"]
    AppFactory["createApp"]
  end

  UI <-->|"actions, state and answer text"| Rag
  UI -.->|"uses"| ChatServiceContract
  Rag -.->|"implements"| ChatServiceContract
  Rag -.->|"uses"| PortContract
  Rag -.->|"uses"| LifecycleContract
  Rag -.->|"uses"| ContentContract
  CoordinatorContract -.->|"extends"| LifecycleContract
  Rag <-->|"generate; Cancel"| Chat
  Rag <-->|"retrieve; Cancel"| DB
  Rag <-->|"begin, finish and reconnect"| Coordinator
  Rag <-->|"load selected passages"| Content
  Content -->|"read"| Chunks
  Rag <-->|"prepare prompt"| Prompt
  Rag -.->|"uses"| PromptContract
  Prompt -.->|"implements"| PromptContract
  Chat -.->|"extends"| Standard
  DB -.->|"extends"| Standard
  Standard -.->|"extends"| StandardBase
  StandardBase -.->|"implements"| PortContract
  Content -.->|"implements"| ContentContract
  Chat <-->|"route generation messages"| Coordinator
  DB <-->|"route retrieval messages"| Coordinator
  Coordinator -.->|"extends"| CoordinatorBase
  CoordinatorBase -.->|"implements"| CoordinatorContract
  Coordinator <-->|"native worker transport"| Connection
  Connection -.->|"extends"| Transport
  Connection <-->|"MessagePort"| Hub
  Hub <-->|"retrieval request and result"| Retrieval
  Retrieval <-->|"embed and search"| Index
  Retrieval -.->|"driver satisfies"| DriverContract
  Index -->|"load or reuse"| RetrievalAssets
  Hub <-->|"generation, stream and confirmed stop"| GenerationRuntime
  GenerationRuntime -->|"create or reset driver"| GenerationFactory
  GenerationFactory -->|"returns handler"| Generation
  GenerationRuntime <-->|"handle and publish"| Generation
  GenerationFactory -.->|"returns"| DriverContract
  Generation -.->|"uses"| GenerationBase
  Generation -->|"selected implementation"| Local
  Generation -->|"selected implementation"| Online
  Local -.->|"extends"| GenerationBase
  Online -.->|"extends"| GenerationBase
  Local -->|"load or reuse"| LocalWeights
  Online <-->|"HTTP stream; abort on Cancel"| API
  API -.->|"depends on"| ProviderBase
  API -->|"generate through injected provider"| Provider
  Provider -.->|"extends"| ProviderBase
  API -.->|"uses"| RequestDTO
  Provider -.->|"uses"| RequestDTO
  Provider -->|"server-owned instructions"| Instructions
  Provider <-->|"stream; AbortSignal"| SDK
  SDK <-->|"request and streamed response"| OpenAI

  classDef added stroke:#2da44e,stroke-width:3px;
  class GenerationBase,Online,API,RequestDTO,Instructions,ProviderBase,Provider,SDK,OpenAI,ServerComposition,AppFactory added;

  classDef modified stroke:#bf8700,stroke-width:3px;
  class GenerationFactory,Generation,Local,BrowserFactory modified;
  style GenerationWorker stroke:#bf8700,stroke-width:3px
```
