# Choose a saved conversation from the chat log

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Let visitors explicitly choose an older saved conversation from a chat log. The user requested this as a separate follow-up to the switchable Local/Online chatbot and IndexedDB history work. Fresh tabs and fresh browser sessions start new conversations; opening a saved conversation is an explicit visitor action.

**What to build:** a chat-log view backed by the existing history repository, with a selection action that loads a saved conversation into the chatbot. Preserve the shared chat presentation, RagService orchestration and Local/Online generation boundary.

Include the durable conversation catalog and recovery of conversations whose tab-local ID pointer was lost. The user explicitly assigned this feature to this ticket. Persist conversation IDs and identifying metadata in IndexedDB, so discovery does not depend on sessionStorage, an in-memory ID list, or the old tab still existing.

**Demo path:** create and persist two conversations, open a fresh tab with a new empty conversation, select either saved conversation from the log, and continue it using the chosen generation mode without mixing messages between conversations.

## Prerequisites

- Current stage: queued for design. No implementation mode or branch has been selected for this follow-up.
- Complete the IndexedDB history foundation in the prerequisite ticket, including conversation identity, ordered persistence, Reset and blocking storage-error behavior.
- Inspect the prerequisite's actual record schema. Reuse its durable conversation keys and derive catalog metadata from existing histories where possible; older valid conversations must not be excluded merely because the catalog feature was added later. Agree any required migration/backfill before implementation.
- Agree log presentation and ordering, whether an unfinished current conversation is retained when selecting another, and how selection waits for or cancels accepted work and pending writes.
- Decide how selecting a conversation already open in another tab affects writer ownership. Independent tab conversations must not accidentally overwrite each other; no collaboration or automatic copying policy has been approved.
- Reuse existing repository/contracts, configuration service, shared components and composition before introducing new equivalents.

## Acceptance criteria

- [ ] The visitor can view saved conversations and explicitly choose one to load. Log entries provide enough identifying information to distinguish the selected conversation.
- [ ] The IndexedDB-backed conversation catalog includes each saved conversation's ID, creation/update timestamps and an identifying label or preview. Catalog entries remain consistent with history updates and Reset.
- [ ] After the browser is closed or killed and tab-local sessionStorage IDs are lost, reopening the app still allows the log to discover retained IndexedDB conversations and explicitly load the chosen one. Recovery requires no remembered ID or retained tab-local registry.
- [ ] Valid histories created before the catalog feature are discoverable using their persisted keys and the agreed metadata derivation/migration strategy. Missing optional display metadata does not hide an otherwise recoverable conversation.
- [ ] Loading restores its persisted message order and interrupted-response markers without automatically replaying a question or resuming generation.
- [ ] Fresh tabs and fresh browser sessions continue to start new conversations unless the visitor explicitly selects a saved one.
- [ ] Selecting or continuing a conversation preserves the chosen Local/Online configuration, and switching generation mode preserves the selected conversation.
- [ ] Pending generation, storage writes and late callbacks follow the selection policy agreed during design; output or persistence from one conversation cannot be installed in another.
- [ ] Storage failures use the existing blocking recovery behavior. Selecting or resetting one conversation preserves other saved conversations, preferences and model caches.
- [ ] Tests and actual browser verification cover creating multiple histories, a fresh-tab startup, selecting each saved conversation, mode switching and the agreed failure/concurrency cases.

## Dependencies

**Blocked by:** [Switch Local and Online chatbot trees through dependency injection](../20261105-222408/TASK.md), specifically its IndexedDB history repository and conversation identity/lifecycle contract.

No dependency on merging the older PR #23 approach; reuse the resulting replacement interfaces.

## Definition of Done

- [ ] Design, public test seams, storage/concurrency behavior and verification commands are agreed in this ticket before implementation.
- [ ] Acceptance criteria pass the repository implementation flow, including focused checks, browser verification, independent reviews and the final full suite.
- [ ] Service and whole-application Mermaid diagrams are updated under docs/architecture/ using the required naming, layer and border conventions.
- [ ] Reusable code and concise evidence summaries are committed; routine run output remains retained artifacts with accessible links and stated retention.
