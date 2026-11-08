# Agent instructions

For feature work, bug fixes, or an explicit `implementation-flow` request, follow [the implementation flow](docs/implementation-flow.md). Resume an existing TATR ticket at its recorded stage.

The issue tracker is the repository's `tasks/<HUID>/TASK.md` files. Use [tatr-ticket](.agents/skills/tatr-ticket/SKILL.md) to create tickets and use their acceptance criteria as the implementation spec.

When wiring dependencies or adding or moving helpers, types or contracts, follow [dependency and helper placement](README.md#dependency-and-helper-placement).

For architecture Mermaid in PRs, docs, tickets or chat, use [architecture-mermaid](.agents/skills/architecture-mermaid/SKILL.md).

## Documentation and code comments

Before adding or changing documentation (including AGENTS.md and README.md) or adding code comments or docstrings, ask the user and wait for explicit approval.

## Ticket planning skills

Use [to-tickets](.agents/skills/to-tickets/SKILL.md) when explicitly requested to divide or refine planned work. The [tracker configuration](docs/agents/issue-tracker.md) preserves TATR IDs, status and blocking relationships; the [domain rules](docs/agents/domain.md) point to the glossary and ADRs. Existing user-approved grouping and publication scope take precedence over generic skill defaults.
