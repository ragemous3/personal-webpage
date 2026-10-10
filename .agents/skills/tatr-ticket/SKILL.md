---
name: tatr-ticket
description: Create Tsoding TATR bug and task tickets from notes or repository context. Use when asked to create a TATR ticket, report a bug in tasks/, or turn planned work into a TATR task. Also support draft requests.
---

# TATR tickets

## 1. Ground the ticket

Read the project's instructions and relevant existing `tasks/*/TASK.md` files. Check `tasks/tags` when present. Resolve the requested project before writing; use the current repository when it is unambiguous.

Choose **bug** for behavior that contradicts an established expectation; choose **task** for planned work. Ask which kind when the distinction changes the ticket and the request does not settle it.

Inspect only the code, documentation, and evidence needed to describe this ticket. Distinguish observed behavior, user reports, and suspected causes. Cite relevant paths, ticket IDs, or supplied links in the description.

Ask a short question only when a missing answer changes the target project, intended outcome, or scope. Mark other gaps `Not yet established` or list a specific open question in the relevant section. Keep unverified reproduction steps explicitly proposed. Finish this step when the kind, target, and intended outcome are clear enough to write a useful ticket.

## 2. Fill the selected template

Read [assets/bug.md](assets/bug.md) for a bug or [assets/task.md](assets/task.md) for a task. Preserve its section names and order. Replace each placeholder with supported details, proposed future checks, or a stated unknown. Use plain English unless the user requests another language.

Write a short title naming the failure for a bug or the intended change for a task. Keep one ticket focused on one independently verifiable outcome; propose a split when work has unrelated outcomes or unresolved sequencing.

For tasks, keep these distinctions:

- **Background:** Explain why the ticket exists and the value completing it will provide.
- **Prerequisites:** State conditions, access, or setup needed before work can start.
- **Acceptance criteria:** Write observable outcomes that determine whether the requested change is correct.
- **Dependencies:** Name other tickets, deliverables, or decisions this work relies on. Use links when known; otherwise name the missing item. Write `None identified` when none are known.
- **Definition of Done:** Record completion checks and the evidence required to close the ticket. Refer to the acceptance criteria rather than repeating them. Include repository-required checks and relevant verification; add reviews or documentation requirements only when agreed or required by the project.

Write acceptance criteria and DoD as unchecked checklists for future work. Keep suspected fixes in the evidence or open questions until confirmed. Finish this step when every section contains useful content or an explicit unknown and all criteria can be checked.

## 3. Create or draft

Read [references/tatr.md](references/tatr.md) before producing the header or path. Reuse repository priority and tag conventions. Otherwise use priority `100` and the kind tag `bug` or `task`. Set new tickets to `OPEN`.

For a **draft request**, return the complete ticket Markdown without writing to the project.

For a **create request**, write the completed template body to a temporary UTF-8 file outside `tasks/`, then run the bundled helper with structured arguments or properly quoted shell arguments. The helper creates the root `tasks/` directory if absent:

```sh
python3 <skill-directory>/scripts/create_ticket.py \
  --project <project-root> --kind task \
  --title '<title>' --body-file <completed-body-file>
```

Use `--kind bug` for bugs. Use `--priority`, repeatable `--tag`, `--type-tag`, and `--suffix` only when the request or repository conventions call for them. Resolve the script relative to this skill, not the project.

If Python is unavailable, create the same file using local tools: reserve a new UTC HUID directory with exclusive creation, wait one second and retry on collision, and write the compliant header followed by the completed body. Preserve existing tickets.

Read the created `TASK.md` back. Check the HUID, contiguous metadata, selected template headings, resolved placeholders, and criteria. If a local TATR CLI is available, use its help and listing commands for an additional compatibility check. Finish when the file exists and these checks pass.

Return the path, title, kind, and any unresolved details that matter to starting work. Ticket creation leaves implementation and Git commits for separately requested work.
