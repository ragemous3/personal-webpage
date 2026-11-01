# Issue tracker

Use the repository's TATR files in `tasks/<HUID>/TASK.md`. GitHub hosts pull requests, not a second issue tracker for this workflow. Preserve existing ticket IDs when refining agreed work.

Use [tatr-ticket](../../.agents/skills/tatr-ticket/SKILL.md) for the format and [to-tickets](../../.agents/skills/to-tickets/SKILL.md) for scope, demonstrable outcomes and blocking relationships. Keep the five TATR sections in their existing order. Put **Blocked by** links in Dependencies; separate actual prerequisites from historical references and downstream consumers. Higher numeric priorities sort first but do not themselves create dependencies.

Status is OPEN or CLOSED. Reuse existing tags such as task, refactor and verification. No triage skill or ready-for-agent labels are configured. An OPEN ticket can still have design decisions to settle; record those under Prerequisites. Publishing a planning PR does not close the implementation tickets it describes.

Follow [the implementation flow](../implementation-flow.md) for later product work, including implementation-mode selection. Reuse approval already given for ticket updates and publication; ask only about changes outside that approved scope. Keep user-approved merged tickets together unless the user approves a new split.
