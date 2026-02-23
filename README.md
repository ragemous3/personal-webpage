<!--toc:start-->

- [About](#about)
- [Infrastructure](#infrastructure)
- [Naming convention for folders](#naming-convention-for-folders)
- [Naming convention for files](#naming-convention-for-files)
- [Folder structure](#folder-structure)
<!--toc:end-->

## About

## Casing naming convention

Using kebab-case for id and classes in CSS.
Using camelCase for javascript

## Tech stack

Hugo, lit and CSS.

## Infrastructure

Site has a simple architecture using `feature colocation` with logic and data tucked away
in services and view logic in webcomponents (lit) - Shadow DOM used for total isolation for a singular feature. That also means  
to not register anything other than the top level feature (see folder structure) of a folder: e.g. only register chatbot globally, all other componets are imported into chatbot
that is located in chatbot/components folder.
Only with pre-decided elements changeable from outside. The idea is to keep it simple and isolated. Shared folder will
carry the "library" to import reusable to fulfil DRY (dont repeat yourself and KISS) criteria.
HUGO will carry the main holding page infrastructure, page routing logic and business values carried from config.toml

If need be - certain features will have interceptors and adapters (map data models to and from).

## Naming convention for folders

`kebab-case`.

## Naming convention for files

kebab-case name + dot-separated responsibility. I.e. `api-base.service.ts`.

**Valid types:**

- service
- component
- test
- worker
- lit
  Why? I find it very readable and i instantly know where to look.

## Folder structure

Implementing `feature colocation` with domain and infra logic together in shared/services
Generic components goes into component folder, generic models into models (i.e utility types) and so on.
Should be able to delete a feature without any problems

**Folder structure Example**

```
|-- features
|   `-- chatbot
|       |-- chatbot.component.ts
|       |-- chatbot.test.ts
|       |-- components
|       |-- constants
|       `-- models
|-- jsconfig.json
|-- shared
|   |-- components
|   |-- constants.ts
|   |-- models.ts
|   |-- services
|   |   |-- api-base.service.ts
|   |   |-- idb.service.ts
|   |   |-- llm.service.ts
|   |   |-- rag.service.ts
|   |   `-- vectordb.service.ts
|   `-- workers
|       |-- computation.worker.ts
|       `-- models.ts
|-- transformers-test.ts
`-- tsconfig.json
```
