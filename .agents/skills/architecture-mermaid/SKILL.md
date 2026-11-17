---
name: architecture-mermaid
description: Use when creating, updating or reviewing architecture Mermaid diagrams for PRs, documentation, tickets or chat. Apply the full layered flow, exact code names, contracts and abstracts, disconnected composition, and green/yellow change borders.
---

# Architecture Mermaid

This skill owns the architecture diagram style across PRs, docs, tickets and chat. The [diagram index](../../../docs/architecture/README.md) owns saved locations and the service inventory; the [implementation flow](../../../docs/implementation-flow.md) owns refresh timing and publication.

## 1. Ground the scope

Read the relevant source, existing diagrams and ticket. Choose the feature slice or application overview the user needs. Trace the complete flow within that scope, including returned data, subscriptions, cancellation, storage and external systems.

For implemented work, inspect the diff against the ticket's fixed review-base SHA with rename detection, including staged and unstaged changes. Account for added, changed and removed services and their dependencies. For a proposal, inspect the current baseline and distinguish existing behavior from intended changes; keep unsettled ownership and execution placement explicit.

This step is complete when every existing label and relationship is grounded in source, and proposed elements are identified as proposals.

## 2. Draw the full layer flow

- Use `flowchart TB`. Group nodes by the actual Views, Services, Data and Shared layers, with worker execution contexts, server integration and storage/external resources where relevant. Keep each contract or model in its owning layer; some contracts belong to Data.
- Use exact class, function, contract, abstract, route, filename and package names, preserving case. Put roles and paths in secondary annotations. Mark provisional names as proposed. Include the contracts and abstract classes that define the shown boundaries; add abstractions only when the source or proposal contains them.
- Show the concrete path from the view through the service and data mechanisms to resources and back. Preserve relevant alternatives such as Local and Online, and identify each worker by its real entry-point filename.
- Use solid, labelled arrows for runtime calls and data. Use dotted, labelled arrows for type dependencies, implementation, inheritance and aliases. Runtime arrows connect concrete mechanisms; contract boxes describe the types used at those boundaries.
- Keep composition entry points in a separate group of isolated boxes, containing names only. Composition has no runtime or type edges, including edges between its own boxes.
- Keep boxes separate where ownership, execution context or change status differs. Preserve the theme's default fill.

This step is complete when the selected feature can be followed end to end and its contracts, abstracts and execution boundaries are visible. Choose a narrower feature scope when needed, while retaining the full flow within it.

## 3. Mark changes and provenance

Use these border classes:

```text
classDef added stroke:#2da44e,stroke-width:3px;
classDef modified stroke:#bf8700,stroke-width:3px;
```

- Green marks added components or dependencies. Yellow marks existing components represented by modified source files. Unchanged components and pure moves/renames keep default borders. Added status takes precedence over modified status.
- A new path alone does not make extracted existing code new. A move with behavior changes is yellow. When a module changes but a contained class does not, apply the border to its file container. Split grouped members with different statuses. Omit removed components from the resulting architecture and explain relevant removals outside the block.
- For implemented diagrams, put the full comparison-base SHA and latest implementation commit SHA outside the block. Use the implementation snapshot, not the diagram-only commit. Identify uncommitted code and incomplete verification explicitly. Recompute colors across saved diagrams when the comparison base changes.
- For proposals, state the baseline and that green/yellow mean intended additions/modifications. Keep candidate libraries, provisional names and unresolved placement visibly provisional; a proposal has no claimed implementation SHA.
- Include a short legend for colors and solid/dotted arrows. State verification limits separately: a successful Mermaid render establishes diagram syntax, not runtime behavior.

This step is complete when every highlight matches the stated comparison or proposal and its meaning is clear without conversation history.

## 4. Save, validate and reuse

For implemented work, update the [saved diagram inventory](../../../docs/architecture/README.md): exactly one Mermaid diagram per service file and one application overview under `docs/architecture/`. The overview connects all active services and their shared infrastructure. Update affected diagrams in place, including every diagram that shows a changed dependency, contract, lifecycle or persistence boundary; preserve unrelated accurate paths. Keep the inventory current when services are added or removed. For partial runs, describe the actual code and its verification state.

Keep planned architecture in its ticket/proposal until implemented. A chat-only explanation need not create a new documentation file. When showing the same scope and revision in a PR or chat, reuse the saved Mermaid block with its legend and provenance; keep the complete feature flow consistent across surfaces. Link the application overview for broader context. Clearly label any separately requested summary as a different scope.

Render each changed diagram with Mermaid, then check source names, owning layers, arrow semantics, disconnected composition, border classifications and relative links. Confirm one block per saved diagram and compare PR/chat copies with their source. If rendering is unavailable, report that check as unperformed.

Record the checked base, implementation/proposal state, affected paths and render result in the ticket when the implementation workflow requires it. If nothing changed, record the check without rewriting diagrams. Keep Mermaid source and concise provenance with the source snapshot; store routine renders and validation output according to the [verification evidence policy](../../../docs/verification-evidence.md).

This step is complete when the required inventory is covered, affected diagrams pass these checks, and published or displayed copies agree with their source. Report remaining gaps explicitly.
