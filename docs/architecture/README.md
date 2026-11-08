# Architecture diagrams

Use [architecture-mermaid](../../.agents/skills/architecture-mermaid/SKILL.md) when creating, updating or reviewing these diagrams, or reusing them in PRs and chat. The skill owns the drawing style, change borders, comparison metadata and validation. The [implementation flow](../implementation-flow.md) owns refresh timing.

## Saved diagrams

This table indexes the implemented architecture. Keep it aligned with the service inventory using the skill's save procedure.

| Scope | Diagram | Service source |
| --- | --- | --- |
| Whole application | [application.md](application.md) | All active services and runtime boundaries |
| Résumé questions and generation | [rag-service.md](rag-service.md) | [RagService](../../assets/layers/services/rag.service.ts) |
| Settings and model choices | [configuration-service.md](configuration-service.md) | [ConfigurationService](../../assets/layers/services/configuration.service.ts) |
| Model progress | [progress-service.md](progress-service.md) | [ProgressService](../../assets/layers/services/progress.service.ts) |
| Spoken assistant answers | [talking-head-service.md](talking-head-service.md) | [TalkingHeadService](../../assets/layers/services/talking-head.service.ts) |
