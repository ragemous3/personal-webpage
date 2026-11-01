---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets, each declaring its blocking edges, published to the configured tracker (edges as text in one file per ticket locally, or native blocking links on a real tracker).
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets**: tracer-bullet vertical slices, each declaring the tickets that **block** it.

## Repository integration

Read [the tracker configuration](../../../docs/agents/issue-tracker.md) and [domain documentation rules](../../../docs/agents/domain.md). Use [tatr-ticket](../tatr-ticket/SKILL.md) for the TATR header, section order and file creation. Tickets live in the existing `tasks/` tracker. Do not create a second tracker under `.scratch/` or GitHub Issues.

Reuse existing user approval for ticket grouping and publication. Ask about a new split or merge only when it changes that approved scope. User instructions and the repository implementation flow take precedence over this skill. Ticket publication alone does not complete the work described by a ticket.

The upstream source, revision, license and local adaptations are recorded in [SOURCE.md](SOURCE.md).

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges**: the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change (rename a column, retype a shared symbol) whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket; green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the tickets to the configured tracker

Publish the approved tickets. **How** depends on the tracker `/setup-matt-pocock-skills` configured; the tickets are the same either way, only the shape of the blocking edges changes:

- **This repository's TATR tracker** → update the selected existing tickets, preserving their IDs and historical evidence. Create new tickets only for an approved new outcome. Write explicit **Blocked by** links in Dependencies and distinguish blockers from reference material and follow-up consumers. Higher priority numbers schedule work first, but priority alone is not a blocking edge.
- Keep tickets OPEN until their own implementation workflow is complete. Record unresolved design gates under Prerequisites; do not mark a ticket ready merely because its description is written. No triage labels are configured here.

Work the **frontier**: any ticket whose blockers are all done. For a purely linear chain that means top to bottom.

Only modify the tickets selected by the user. Preserve the TATR template's section names and order. Within those sections, include:

- Background: what to build and a concrete demo or verification path.
- Prerequisites: unresolved decisions and setup needed to start.
- Acceptance criteria: observable checks owned by this ticket; state how a failure would be detected. Separate regression checks from newly delivered behavior.
- Dependencies: explicit Blocked by links or None, followed by references and consumers.
- Definition of Done: evidence required to close this ticket, without grading future work owned by a dependent ticket.

Avoid incidental implementation paths or code snippets: they go stale fast. Keep tracker/evidence links and user-approved naming decisions where needed for TATR traceability. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.
