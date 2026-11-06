# Architecture diagrams

Maintain these diagrams at the end of every implementation-workflow run and fix pass, including follow-up changes and PR handoff. A run is a unit of agent work, rather than each individual test invocation. The diagrams describe the resulting application code; planned behavior belongs in the ticket until implemented.

## Saved diagrams

Keep exactly one Mermaid diagram per service file and one application overview. Update these files in place; Git retains their history.

| Scope | Diagram | Service source |
| --- | --- | --- |
| Whole application | [application.md](application.md) | All active services and runtime boundaries |
| Résumé questions and generation | [rag-service.md](rag-service.md) | [RagService](../../assets/layers/services/chatbot.service.ts) |
| Settings and model choices | [configuration-service.md](configuration-service.md) | [ConfigurationService](../../assets/layers/services/configuration.service.ts) |
| Model progress | [progress-service.md](progress-service.md) | [ProgressService](../../assets/layers/services/progress.service.ts) |

Each service diagram shows its feature from the view, through its service and data mechanisms, to storage or external systems and back. Include the contracts and abstract classes that define those seams. The application overview connects all active services and their shared infrastructure. Keep composition entry-point names in isolated boxes with no edges to the connected layer flow.

## Refresh procedure

1. Inspect the service inventory and the diff against the ticket's fixed review base, with rename detection. Account for added, changed and removed services in the table and diagram files. Match diagram labels to exact code identifiers, filenames, routes and package names; use the repository's actual layers.
2. Update every affected service diagram and the application overview to reflect current calls, returned data, subscriptions, cancellation and Local/Online alternatives. When a dependency, contract, abstract, lifecycle, persistence boundary or feature flow changes, refresh every diagram that shows it. Preserve unrelated accurate paths.
3. Recompute border classes from that comparison. New components or dependencies are green; existing components represented by modified source files are yellow. Pure moves or renames keep default borders; moved code that also changes is yellow. New-file paths alone do not make extracted existing code new. Split boxes whose members have different change status. Added status takes precedence over modified status.
4. Put the full comparison-base SHA and the latest implementation commit SHA outside each Mermaid block. Use the implementation commit, not the diagram commit itself. If code is uncommitted or verification is incomplete, say so explicitly. When a new ticket changes the comparison base, recompute colors and metadata across the saved diagrams so old highlights do not imply current changes.
5. Render each changed diagram with Mermaid. Check that labels resolve to the code, arrows match real relationships, composition has no edges, and green/yellow borders match the diff. Check relative links and confirm exactly one Mermaid block per diagram file. Compare PR diagrams with the corresponding saved blocks when preparing or updating a PR.
6. Record the checked implementation, base, changed diagram paths and render result in the ticket. Commit the updated Markdown with the implementation snapshot. If the check finds no diagram changes, record that result without rewriting files. A pass is complete when the service inventory is covered, the application overview agrees with it, and every affected diagram passes these checks.

For a partial or blocked run, save diagrams that describe the actual code and label their verification state accurately. Diagram changes do not imply runtime verification. Keep routine rendered images and validation output in ignored artifacts; commit the Mermaid source and concise comparison metadata.

## Drawing style

- Group nodes by Views, Services, Shared contracts/models, Data, worker execution contexts, server API/provider integration, and external resources as applicable. Show existing layers only.
- Use exact class, function, contract and abstract names, preserving case. Add role descriptions or source paths as secondary annotations. Identify each SharedWorker with its real entry-point filename.
- Use solid labelled arrows for runtime calls or data, and dotted labelled arrows for type dependencies, contract implementation and inheritance. Contracts and abstracts describe types; runtime arrows connect the concrete mechanisms that execute the work.
- Preserve the theme's default fill. Use green borders for added boxes, yellow borders for modified boxes, and default borders for unchanged boxes. Apply a border to a file container when its module changes but a contained class remains unchanged.
- Keep composition disconnected. Include only the names of its entry points; its wiring is outside the layer flow.
- Include a short legend and comparison metadata with each diagram. The colors describe a named comparison, rather than a permanent property of a component.

Use these Mermaid classes in each saved diagram, assigning nodes only to their applicable status:

```text
classDef added stroke:#2da44e,stroke-width:3px;
classDef modified stroke:#bf8700,stroke-width:3px;
```

The same styles can be applied to a source-file container with Mermaid's style statement. Keep the PR's feature diagrams copied from the saved service blocks, and link the application overview for the wider context.
