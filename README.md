<!--toc:start-->

- [About](#about)
- [Tech stack](#tech-stack)
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

## Infrastructure

The infrastructure is aiming to follow SOLID principles and is built on OO (Object oriented) foundation.

### Composition root (called composition in the folder tree)

The composition root is essentially the app - it's responsible for constructing concrete dependencies and providing them to the component tree.
The web components providing the components with dependencies.

In this project, Lit provider components and factories act as the composition root.

The composition root may depend on all layers because its job is wiring, not application logic.

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

**Layer dependency direction**
The direction of the dependencies is always only one direction.

```text
view->service->data
```

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

- **spec**  
  Test files.

- **constant**
  Constant file

- **worker**  
  Web Worker used to offload heavy calculations from the main thread.

- **shared-worker**  
  Shared Worker used as a state machine in this project, so data is not reloaded when a user opens a new tab.

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

### See unused dependencies

> [!NOTE]
> Unclear why but latest knip does not work on my machine - runs out of memory.

```bash
npm run knip
```
