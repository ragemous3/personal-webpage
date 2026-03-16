<!--toc:start-->

- [About](#about)
- [Tech stack](#tech-stack)
- [Infrastructure](#infrastructure)
- [Naming convention](#naming-convention)
- [Naming convention for files](#naming-convention-for-files)
- [Folder structure](#folder-structure)
- [Dev notes](#dev-notes)
  - [To debug caching issues:](#to-debug-caching-issues)
  <!--toc:end-->

> [!WARNING]
> Note that information is subject to change here.

## About

## Tech stack

Hugo, lit and CSS.

## Infrastructure

> [!WARNING]
> This will be subject to change in order to follow SOLID - with emphasis on the D.

Site has a simple architecture using `feature colocation` with logic and data tucked away
in services and view rendering in webcomponents (lit) - Shadow DOM used for total isolation for a singular feature. That also means  
to not register anything other than the top level feature (see folder structure) of a folder: e.g. only register chatbot globally, all other componets are imported into chatbot
that is located in chatbot/components folder.
Only with pre-decided elements changeable from outside. The idea is to keep it simple and isolated. Shared folder will
carry the "library" to import reusable to fulfil DRY (dont repeat yourself and KISS) criteria.
HUGO will carry the main holding page infrastructure, page routing logic and business values carried from config.toml

If need be - certain features will have interceptors and adapters (map data models to and from).

## Naming convention

| Context            | Case                                      |
| ------------------ | ----------------------------------------- |
| Directories        | kebab-case                                |
| Content filenames  | kebab-case                                |
| Layouts/partials   | kebab-case                                |
| Front matter keys  | snake_case                                |
| TOML keys          | snake_case                                |
| Template variables | camelCase                                 |
| CSS classes        | kebab-case                                |
| CSS id             | kebab-case                                |
| JS classes         | PascalCase                                |
| JS functions/vars  | camelCase                                 |
| JS filenames       | [See below](#naming-convention-for-files) |

## Naming convention for files

kebab-case name + dot-separated responsibility. I.e. `api-base.service.ts`.

**Valid types:**

- component
- service
- infra
- test
- worker
- shared-worker

  Why? I find it very readable and i instantly know where to look.

## Folder structure

Implementing `feature colocation` with domain and infra logic under the same name - any higher up generics in shared.
Generic components goes into component folder, generic models into models (i.e utility types) and so on.
Should be able to delete a feature without any problems

**Folder structure Example**

```
|-- config
|   |-- NOTE.md
|   `-- common
|       `-- runner.js
|-- features
|   `-- chatbot
|       |-- chatbot.component.ts
|       |-- chatbot.styles.ts
|       |-- components
|       |   |-- chat-bubble.template.ts
|       |   `-- chat-input.template.ts
|       |-- constants
|       |   |-- prompts.ts
|       |   |-- rag-state.ts
|       |   `-- ragstates.ts
|       |-- models
|       |   `-- models.ts
|       |-- services
|       |   |-- chatbot.service.ts
|       |   |-- llm.service.ts
|       |   |-- rag.service.ts
|       |   `-- vectordbHNSW.service.ts
|       `-- workers
|           |-- distributor.shared-worker.ts
|           |-- hub.worker.ts
|           |-- llm.worker.ts
|           `-- vectordb.worker.ts
|-- jsconfig.json
|-- shared
|   |-- components
|   |-- constants.ts
|   |-- guards
|   |   `-- guards.ts
|   |-- models.ts
|   |-- services
|   |   |-- api-base.service.ts
|   |   `-- idb.service.ts
|   |-- styles.css
|   |-- utils.ts
|   `-- workers
|       |-- models.ts
|       `-- worker-manager.ts
`-- tsconfig.json
```

## Dev notes

### To debug caching issues:

```bash
hugo serve --disableFastRender --ignoreCache --noHTTPCache
```
