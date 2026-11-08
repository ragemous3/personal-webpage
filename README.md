<!--toc:start-->

- [About](#about)
- [Tech stack](#tech-stack)
- [Task tracking](#task-tracking)
- [Infrastructure](#infrastructure)
  - [Composition root (called composition in the folder tree)](#composition-root-called-composition-in-the-folder-tree)
  - [Layers - Dynamic data handling](#layers-dynamic-data-handling)
  - [Contracts](#contracts)
  - [Static Data](#static-data)
- [Folder structure](#folder-structure)
- [Naming convention](#naming-convention)
- [Naming convention for files](#naming-convention-for-files)
- [Dev notes](#dev-notes)
  - [To debug caching issues:](#to-debug-caching-issues)
  <!--toc:end-->

> [!WARNING]
> Note that information is subject to change here.

## About

## Tech stack

Hugo, typescript, lit3.0 and CSS.

## Task tracking

Project tasks live in [`tasks/`](tasks/) and follow [TATR](https://github.com/tsoding/tatr)'s Markdown format. On Linux, follow the [TATR setup and quick start](tasks/README.md), then use `tatr new` to create a task and `tatr ls` to list open tasks from this repository.

## Infrastructure

The infrastructure is aiming to follow SOLID principles and is built on OO (Object oriented) foundation.

### Composition root (called composition in the folder tree)

Composition owns dependency wiring between layers. Its factories construct concrete dependencies; Lit providers supply them to component trees through Lit context. Composition may import from every layer.

ChatbotProvider owns the shared configuration, retrieval DB and history repository. Each mode provider owns its RagService and generation dependency, and disposes them when that tree unmounts. Factories supply construction and cleanup functions to those owners. RagService owns response cancellation and persistence ordering; RuntimeCoordinator owns cross-tab response leases. Accepted writes finish before the shared history repository closes.

### Layers - Dynamic data handling

For dynamic data, The app is divided into three layers: data, service and view - all with different responsibilities.

**Layers**

**View layer**

The view layer renders UI and forwards user intent to the service layer.
The view layer should not directly access workers, IndexedDB, vector databases, model loading, persistence, or other low-level mechanisms.

**Service layer**

The service layer owns application use cases.
It coordinates the data layer, applies application rules, and exposes simple methods to the view layer.
It handles state retrieval to view layer through data layer mechanisms.
The service layer is the main orchestration layer.

**Data layer**

The data layer contains technical mechanisms and data access.
This includes workers, SharedWorkers, BroadcastChannel, IndexedDB, fetch, runtime config, model loading, vector search, and persistence logic.
The data layer hides low-level implementation details behind simple methods that the service layer can call.

### Dependency and helper placement

Application interactions follow this direction through injected contracts:

```text
view->service->data
```

- Views, services and data modules may import directly from their own layer and from shared. Composition wires concrete dependencies across layers.
- Class implementation files contain imports and their class. Put class-specific helpers and constants inside the class. Keep reusable helpers, types, interfaces and guards in their owning area's utils, models, contracts, constants or guards folder. Factory, worker entry-point and utility files keep their respective construction, startup and helper functions.
- Put generic utilities and contracts needed across layers in shared. Import same-layer and shared helpers directly; dependency injection is for substitutable dependencies at boundaries.
- Keep composition dependency types in composition/models. Factories, provider web components and context may import them directly. These models may describe the concrete dependencies that composition wires together; keep them independent of factories.
- Before adding a helper, check the owning area and shared for an existing one. Keep a helper local unless its responsibility is generic or it is needed across layers.

For example, composition-only browser-access handling belongs in composition/utils. A reusable value-comparison function belongs in layers/shared/utils. Both use the .utility.ts suffix.

### Contracts

Contracts define the boundaries between layers.

The service layer depends on contracts instead of concrete infrastructure.
Infrastructure classes implement these contracts.

Contracts enforces the Single responsibility principle and keeps
coupling loose. This keeps the service layer testable and prevents browser-specific mechanisms
from leaking into application logic.

### Static Data

It's allowed to provide a web component with dependencies as static data if need be.

Static build-time data may be passed from Hugo into the application.

For pure display data or config, Hugo may provide data directly to the view if no composition root is needed.

```text
hugo->view
```

For configuration or behaviour-affecting data, Hugo should provide data through the composition root.

```text
hugo -> hugo specific import -> provider -> factory -> service or data layer entity.
```

Hugo specific import means `import @params/config` and `import @params`.

## Folder structure

```text
composition  = dependency wiring
config       = static/runtime configuration
layers       = application architecture
```

**Folder structure Example**

```text
|-- composition
|   |-- constants
|   |   `-- <example>.constant.ts
|   |-- context
|   |   `-- <example>.context.ts
|   |-- factories
|   |   `-- <example>.factory.ts
|   |-- specs
|   |   `-- <example>.spec.ts
|   `-- <example>.provider.ts
|
|-- config
|   |-- constants
|   |   `-- <example>.constant.ts
|   |-- specs
|   |   `-- <example>.spec.ts
|   `-- <example>.config.ts
|
|-- layers
|   |-- data
|   |   |-- constants
|   |   |   `-- <example>.constant.ts
|   |   |-- contracts
|   |   |   `-- <example>.contract.ts
|   |   |-- guards
|   |   |   `-- <example>.guard.ts
|   |   |-- models
|   |   |   `-- <example>.model.ts
|   |   |-- specs
|   |   |   `-- <example>.spec.ts
|   |   |-- workers
|   |   |   |-- <example>.worker.ts
|   |   |   `-- <example>.shared-worker.ts
|   |   |-- <example>.adapter.ts
|   |   `-- <example>.data.ts
|   |
|   |-- services
|   |   |-- constants
|   |   |   `-- <example>.constant.ts
|   |   |-- specs
|   |   |   `-- <example>.spec.ts
|   |   `-- <example>.service.ts
|   |
|   |-- shared
|   |   |-- components
|   |   |   `-- <example>.component.ts
|   |   |-- constants
|   |   |   `-- <example>.constant.ts
|   |   |-- contracts
|   |   |   `-- <example>.contract.ts
|   |   |-- guards
|   |   |   `-- <example>.guard.ts
|   |   |-- models
|   |   |   `-- <example>.model.ts
|   |   |-- specs
|   |   |   `-- <example>.spec.ts
|   |   `-- utilities
|   |       `-- <example>.utility.ts
|   |
|   `-- views
|       |-- constants
|       |   `-- <example>.constant.ts
|       |-- specs
|       |   `-- <example>.spec.ts
|       |-- styles
|       |   |-- <example>.style.ts
|       |   `-- <example>.style.css
|       |-- templates
|       |   `-- <example>.template.ts
|       `-- <example>.component.ts
|
|-- jsconfig.json
`-- tsconfig.json
```

## Naming convention

| Context            | Case                                      |
| ------------------ | ----------------------------------------- |
| Directories        | kebab-case                                |
| Content filenames  | kebab-case                                |
| Layouts/partials   | kebab-case                                |
| Front matter keys  | snake_case                                |
| TOML keys          | snake_case                                |
| Template variables | camelCase                                 |
| CSS classes        | keba`b-case                               |
| CSS id             | kebab-case                                |
| JS classes         | PascalCase                                |
| JS functions/vars  | camelCase                                 |
| JS filenames       | [See below](#naming-convention-for-files) |

## Naming convention for files

Use a kebab-case name followed by a dot-separated responsibility.

Example:

```text
kebab-case.dot-separated-responsibility.ts
api-base.service.ts
```

**Valid types:**

- **component**  
  Web component.

- **template**  
  Function returning HTML.

- **style**  
  CSS.

- **service**  
  Service-layer entity. Used to decide sequences and hold the business logic of the app.

- **data**  
  Data-layer entity.

- **adapter**
  Data-layer entity that implements a contract and translates between application-facing operations and a technical interface.

- **client**
  Data-layer entity that makes typed requests to an external service and handles its responses, streams and cancellation. Use the `.client.ts` file suffix, for example `online-chat.client.ts`.

- **spec**  
  Test files.

- **constant**
  Constant file

- **worker**  
  Entry point for a dedicated Web Worker, running separately from the main thread.

- **shared-worker**  
  Entry point for a SharedWorker, which multiple tabs or windows from the same origin can connect to.

- **provider**  
  Web component that provisions dependencies to the underlying trees. A provider may also switch dependencies at runtime, but should not contain logic unrelated to dependency provisioning.

- **factory**  
  Used by providers to create or provide dependencies to web component trees.

- **context**  
  Lit 3.0-specific context used to connect factories with dependency provisioning.

## Dev notes

### To debug caching issues:

```bash
hugo serve --disableFastRender --ignoreCache --noHTTPCache --gc
```

## Linting

```bash
npx eslint . --fix
```

## Removed unused dependencies

```bash
npx knip
```

## Type checking

Run `npm ci`, then `npm run typecheck`. The command uses the locked TypeScript compiler. Generated Hugo output in `public/` and `resources/_gen/` is excluded; application TypeScript remains checked with strict settings. CI runs the same command for pull requests and main updates.
