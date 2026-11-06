# Switch Local and Online chatbot trees through dependency injection

- STATUS: OPEN
- PRIORITY: 200
- TAGS: task, refactor

## Background

The user requested a replacement architecture for the Online feature: a chatbot host view observes configuration and renders a Local or Online chatbot tree. Each tree receives its own dependencies through composition. Online generation belongs in a browser data repository calling the application's API; it does not execute in the generation SharedWorker.

Preserve this ticket ID. The previous implementation and PR #23 remain reference material. Their verified behavior and historical evidence are preserved in [the original ticket at a8bb497](https://github.com/ragemous3/personal-webpage/blob/a8bb49740e4eaceeb6a6552a219c209535e70f41/tasks/20261105-222408/TASK.md). That record describes the previous architecture, not verification of this replacement.

**What to build:** select Local or Online and render the corresponding injected chatbot tree. Reuse the common chatbot presentation and business orchestration where their responsibilities are the same. Local generation uses its model/worker infrastructure; Online generation uses a dedicated Online composition and an API repository. Browser retrieval remains local in both modes, as previously agreed.

**Demo path:** restore saved Online mode without starting the Local generation model; ask a question through the Online tree and Express API; switch to Local after the accepted response finishes and ask another question; switch back with the same conversation intact. Demonstrate Cancel, Reset and explicit Retry in both modes, including partial failure and rapid configuration changes.

## Prerequisites

- Current stage: stage 1, revised architecture and test-seam mapping. The branch and ticket are prepared; replacement implementation has not begun.
- Branch: feature/20261105-222408-switchable-chatbot-trees. Created from a8bb49740e4eaceeb6a6552a219c209535e70f41 on the original feature branch, retaining its reusable code and all skill/workflow changes. Fixed review base remains df7fd5597ec6613af55ddba4506ca61ce6109e7c (the main merge-base), so a future PR is assessed as the complete replacement, not only its difference from PR #23.
- Retain the user's Autopilot through PR handoff grant for this ticket, including routine implementation choices, tests/data preparation, documentation/ticket updates, signed commits, push, PR and CI/review fixes. The latest request authorizes the new branch and revised design. Merge, deployment, and closing the original PR require separate instructions.
- No OpenAI credentials are available. The user-approved controlled HTTP alternative remains the verification method; actual project/model access and real OpenAI output remain unverified.
- Confirm the revised service/transport interfaces and focused check mapping before implementation. Preserve the existing mode-change and history guarantees while replacing the DI boundary.
- User clarification: the Offline or Online web component holds its composition. RagService continues coordinating chat and DB interactions; only chat generation switches online. Retrieval stays in the browser.
- New requirement for design grilling: inject a chat-history repository into RagService to retain conversation history in browser storage, and reuse a singleton retrieval DB across tree switches.
- History Q1 agreed: history is stored durably across visits and has an explicit Reset action. Automatic restoration is governed by the later Q7 decision; same-tab refresh remains open.
- History Q2 agreed: tabs have separate conversations; Local/Online switches continue the same conversation within a tab. Returning-visitor restore and conversation identity still need to be settled.
- History Q3: the user rejected continuing chat in memory when persistence fails. No silent or warning-only memory fallback is authorized; Q4 defines blocking failure handling.
- History Q4 agreed: storage failure disables Send; a mid-response save failure cancels generation, keeps partial output visible and offers Retry saving. Resume chat only when persistence is working again.
- History Q5: no saved-conversation selector in this implementation. [Choose a saved conversation from the chat log](../20261106-125405/TASK.md) records the follow-up.
- History Q6 agreed: Reset clears only the current conversation, including its stored history. Other conversations, preferences and cached models are preserved.
- History Q7 revised: a fresh tab and a fresh browser session each start a new conversation. Do not automatically copy or resume the latest stored conversation. A chat-log selector for accessing older saved conversations is deferred to later work. Whether refreshing the same open tab restores its conversation remains open; explain that refresh differs from a fresh tab/browser session.
- History Q8 agreed: use IndexedDB for persisted chat history. Keep persistence details behind the repository contract and provide explicit schema/version handling.
- History Q9 agreed: save the question before generation and persist response updates before publishing them to the view, using an ordered asynchronous write queue. A failed write stops generation and blocks Send. Restore any unfinished response as interrupted when its conversation is restored.
- Q7 clarification: keep the current conversation across Local/Online switches, loading its persisted history when rebuilding the service tree. The proposed refresh-starts-new rule was not accepted; do not introduce it implicitly. Fresh-tab/browser behavior remains as recorded above.
- Host clarification: the chatbot host should depend only on the injected Offline/Online parts and configuration service, with its own composition. Investigate shared-service lifetimes rather than making the DOM element itself a global singleton. Reuse existing code/classes/contracts wherever their responsibilities fit.
- Naming agreed: use Client for the external-service generation dependency, with the `.client.ts` file responsibility suffix. OnlineChatClient / online-chat.client.ts is the proposed concrete name. README file conventions now include client.
- Chat reuse is required: retain the existing Chat dependency for Local generation and reuse the common injected chat seam in RagService. Do not introduce a parallel LocalChatClient or rename Chat merely for symmetry. OnlineChatClient must satisfy the agreed shared chat interface; any needed contract adaptation must preserve existing Local behavior.
- Q10 agreed: drain the outgoing response and its accepted history writes, mount the destination component, initialize its dependencies, and enable Send when ready. Mount permission is distinct from destination resource readiness.
- Q11 agreed: shared configuration/history/DB dependencies are scoped to the tab/application owner. Mode-specific components release only their own dependencies and subscriptions; they do not dispose borrowed shared services.
- Q12 remains open: explain the distinction between the complete persisted transcript and the bounded history sent to the active model. The user has not approved dropping older turns, automatic summaries or another context-limit policy.
- The user questioned whether a history repository is needed with IndexedDB. Explain its conversation-level load/save/reset and schema/transaction responsibilities versus IndexDBBase's existing open-store helper; repository abstraction/naming is still under discussion.
- Reuse review is mandatory for this design: examine ChatContainer, RagService, configuration/context plumbing, Chat/DB wrappers and their singleton helpers, ApiBase, storage infrastructure and existing metadata repositories before adding counterparts. Record the reused/refactored pieces and the responsibility that justifies each genuinely new component.

### Investigation findings and proposals for the next design round

- The current configuration adapter depends on concrete Chat/DB wrappers and initializes both model roles. The coordinator connection also eagerly connects both worker scripts. A new host view alone cannot make Online generation independent of Local initialization; refactor these lifecycle dependencies along with the generation seam.
- Mount/readiness cycle: active settings currently follow adapter resource initialization. If a destination component creates its own dependencies, waiting for destination readiness before mounting that component is circular. Proposed sequence: drain the old response and accepted writes, authorize the next tree to mount, initialize it, then enable Send. Keep mount permission separate from resource readiness.
- A response lease must remain active until its accepted persistence queue finishes. Reset, detach and tree disposal are distinct operations; old queued writes must not resurrect cleared history or write into another conversation.
- Proposed ownership: one chatbot composition owns configuration, history persistence and the DB wrapper for the tab/application root. The view observes configuration and chooses the injected branch. Mode-specific compositions borrow shared dependencies and dispose only their own subscriptions/generation resources. The actual retrieval index/embedder remains shared across tabs in the existing worker.
- Existing DB singleton helpers ignore subsequent config/runtime arguments and retain disposed wrappers; reusing them requires fixing their ownership contract. The embedding backend currently follows execution settings, so reuse is valid for compatible retrieval configurations; an intentional incompatible configuration change can still require a reload.
- Proposed vocabulary: a repository exposes a stored/domain collection, irrespective of whether its source is local or remote. An API client performs external request/stream operations. ChatHistoryRepository remains a proposal for the IndexedDB history boundary; the user accepted Client for generation HTTP. Reuse existing Chat for Local generation through the agreed shared chat seam. Avoid blanket renaming of ContentRepository or cached ModelMetadataRepository merely because they fetch HTTP data.
- ApiBase currently stores baseURL without using it to resolve requests, provides only GET JSON/byte reads, and lacks POST streaming/abort operations. Reuse must include correct URL resolution and stream support rather than assuming that inheritance supplies them already.
- Full stored history and model input are separate: the current RagService replays all completed turns, while the API rejects more than 40 messages, messages over 32,000 characters, or JSON over 128 KiB. A bounded prompt projection is needed without discarding saved/UI history; agree that policy during grilling.
- IndexDBBase is an open-store helper, not a history repository; it has no explicit version/migration contract. Reuse suitable infrastructure, while giving chat history a deliberate schema and transaction/write-queue design.

### Revised responsibility plan

1. Shared composition supplies the configuration service and per-tab conversation state above both mode-specific trees. Settings controls remain mounted while a response drains or a tree changes.
2. A chatbot host view subscribes to configuration state and renders the Local or Online child tree. Render the active, acknowledged mode after accepted work drains; changing the selected mode alone must not prematurely unmount a responding tree. Keep network, model lifecycle and persistence logic out of the host view.
3. Offline and Online composition supply their respective data implementations through common contracts. Reuse the existing chat controls and RagService behavior rather than duplicating response orchestration or UI logic. Instantiate only the active tree's generation dependencies.
4. The Local tree retains worker-based generation, streaming, confirmed cancellation and model caching. The Online tree uses a new data repository that calls the Express API directly from the browser, including streamed output and AbortSignal cancellation. HTTP generation must no longer be selected inside the language-model worker or require its shared generation queue.
5. Reuse ApiBase as the Online repository's base where applicable. It currently provides JSON and byte reads, not generation POST streaming. Extend its request capability without breaking its existing consumers; keep URL, HTTP and stream parsing details in data implementations.
6. Browser résumé retrieval stays available to both trees. Inject the same singleton retrieval DB through their compositions so a mode switch does not reload its embedding pipeline/index. Determine its owner and disposal scope during grilling; keep general shared configuration and accepted-response coordination separate from Local-only generation resource readiness.
7. RagService owns chat/history orchestration and calls an injected chat-history repository for storage; composition supplies its concrete implementation. The history repository is distinct from the Local/Online generation dependency. Its lifetime survives either mounted tree. Existing RagService disposal resets its own history; replacing the tree must dispose its own subscriptions and transports without erasing stored history. Agree persistence lifetime, conversation scope, Reset and interrupted-response behavior during grilling.
8. Preserve server-owned trusted instructions, server-defined model choices and compatible controls, GPT-6 Luna with low reasoning effort, provider extensibility, and Node.js/Express/TypeScript. Keep usage policies and spending-accounting infrastructure outside this ticket.

### Carry-forward skill, workflow and documentation scope

These changes are included by branch ancestry and must remain in the final replacement PR:

- Repository git-workflow PR-diagram guidance.
- verify-offline-assistant skill, feature map and helper updates, including the corrected type-package dependency lookup.
- Browser-verification artifact policy and hosted Online verification support, adapted to the replacement tree.
- docs/implementation-flow.md and docs/implementation-setup.md changes.
- docs/architecture/README.md, one saved Mermaid diagram per service, and the application overview. Update these to the new architecture when implemented.
- Exact code names, real layer boundaries, contracts/abstracts, green added borders, yellow modified borders, and disconnected composition boxes. Recompute colors against the fixed review base.
- writing-for-agents guidance already applied to the workflow/skill rules: keep one authoritative rule source and explicit completion criteria.
- Existing ticket and evidence history, including the separate reconnect-investigation ticket.

### Proposed verification mapping

- Actual component/composition seam: saved startup selects the correct tree; settings remain available; selected versus active mode governs replacement; no duplicate active tree; rapid edits coalesce; shared history survives disposal/remount; subscriptions and owned resources are released.
- Service seam: retain the existing streaming, cancellation, retry, reset, late-result rejection and history tests with injected Local/Online generation dependencies.
- Data/API seam: ApiBase-compatible repository issues the correct POST request, parses split streaming events, propagates cancellation, reports failures and never exposes credentials or worker-specific transport details.
- Coordinator seam: Online requests and mode changes are not gated on Local generation readiness or its generation queue; preserve accepted-response leases and browser retrieval as applicable.
- Browser journeys: drive both actual mode-specific trees, Local/Online switching, Cancel, Reset, Retry, partial errors, saved preferences and another tab. Use the controlled OpenAI HTTP endpoint and real Express/OpenAI SDK without credentials. Run affected real Local CPU/cache verification with the compatible existing model mirror/index.
- Focused commands will use the existing TypeScript test loader and affected specs; settle their final file mapping with the revised interfaces. Integration checks remain npm run typecheck, npm run lint and npm run build. Final npm test follows both independent reviews.

## Acceptance criteria

- [ ] A chatbot host view subscribes to configuration state and renders the active Local or Online tree using separate composition roots and injected common contracts.
- [ ] Saved settings resolve before starting mode-specific generation. An Online-only visit starts no Local generation model and makes no generation requests through the language-model SharedWorker.
- [ ] Online generation uses a browser data repository with the agreed ApiBase reuse, typed HTTP streaming and cancellation. Local generation retains its worker implementation.
- [ ] Common chat presentation and business orchestration are reused. Both modes retain Send, Cancel, Reset and applicable recovery controls without duplicated business flows.
- [ ] The implementation records its reuse/refactor inventory and explains why each new component is needed instead of duplicating an existing responsibility.
- [ ] Selected mode changes wait for accepted responses to finish, fail or be explicitly cancelled before changing the mounted active tree. Rapid changes coalesce, and stale completions cannot reattach an older tree.
- [ ] The same per-tab conversation survives Local/Online tree disposal and remount. Reset explicitly clears it, and late output cannot repopulate it.
- [ ] RagService accesses saved chat history through an injected repository contract; views contain no storage operations. Restoring, saving, clearing and storage failures follow the lifetime and conversation scope agreed during grilling.
- [ ] Chat history is persisted in IndexedDB with a versioned schema, while the chat-log selection UI is kept in its linked follow-up ticket.
- [ ] History records persist across visits, while a fresh tab or fresh browser session starts a new conversation without automatically resuming/copying an older one. Opening older conversations through a chat log is deferred. Refresh behavior for the same tab follows the decision agreed during grilling.
- [ ] A question is saved before generation starts, and response updates are saved in order before being published to the view. Persisted unfinished answers are marked interrupted on restoration. Different tabs retain separate conversations, and switching modes within a tab continues the same conversation.
- [ ] Storage failures block Send and cancel an active generation when saving fails; partial text remains visible and Retry saving must succeed before further requests are accepted. Reset clears the current conversation's stored history without clearing other conversations, preferences or model caches.
- [ ] Both compositions receive the same singleton retrieval DB at the agreed ownership scope. Mode switches preserve the healthy embedding pipeline/index; unmounting a mode tree does not dispose the shared DB.
- [ ] Browser retrieval remains functional in both modes. General response/configuration coordination does not make Online generation depend on Local model readiness or shared generation serialization.
- [ ] Online model choices and controls reflect the API's allowed configuration. The initial server model is gpt-6-luna with low reasoning effort through the Responses API; keys and trusted instructions remain server-side.
- [ ] Failures retain partial output and require explicit Retry. There is no automatic provider/mode fallback or silent paid-request replay.
- [ ] The Express backend remains Node.js/TypeScript, provider-replaceable and deployment-neutral under /api. No usage-policy or spending-accounting infrastructure is introduced.
- [ ] All carried-forward skill, workflow and architecture-documentation changes listed above are retained in the replacement PR and linked from this ticket.
- [ ] Saved service diagrams and the application overview describe the actual replacement architecture, use the agreed colors and exact names, and render successfully.
- [ ] Controlled API/browser checks verify the replacement without credentials; affected Local CPU/cache checks pass or have an explicitly approved alternative. Previous-branch test results are not represented as verification of the new implementation.

## Dependencies

**Blocked by:** None of the existing implementation tickets. Revised interface/test-seam decisions gate implementation.

- Main baseline: [persisted settings](../20261028-123834/TASK.md) and [RuntimeCoordinator lifecycle](../20261029-193942/TASK.md), both merged.
- [PR #23](https://github.com/ragemous3/personal-webpage/pull/23) is reusable reference code and the preserved prior approach. This new branch is based on its current head; it does not require merging that PR.
- [Reconnect investigation](../20261105-222407/TASK.md) remains OPEN and scheduled afterward; it is not an established blocker.
- Downstream consumer: [chat-log selection](../20261106-125405/TASK.md), blocked by this history/identity foundation.
- Runtime model mirror and compatible résumé index are local verification prerequisites. Credentials are explicitly unavailable and waived for this implementation.

## Definition of Done

- [ ] The revised architecture and final seam/check mapping are recorded in this ticket.
- [ ] Acceptance criteria pass focused and integration checks on the new branch.
- [ ] Runtime verification exercises the switched trees; cleanup, both independent reviews, blast-radius assessment and the final suite apply to the replacement implementation SHA. Prior reviews and test results are historical and invalidated for this architecture change.
- [ ] All intended skill/workflow/architecture changes are committed with the replacement. Routine verification screenshots/reports remain ignored artifacts with accessible links and retention.
- [ ] The new branch is published with its own unmerged PR, an accurate description and updated saved diagrams. Record its PR URL and closure on this branch after handoff.

### Design-run record

Still at stage 1; no replacement runtime implementation has begun. Recorded the user's browser-retrieval boundary, IndexedDB choice, history isolation, ordered save-before-display, blocking storage-error handling, current-conversation Reset and preservation across Local/Online switches. Created the separate chat-log-selection follow-up and linked its dependency. Q10/Q11 now confirm the mount/drain sequence and scoped shared-service ownership. Client naming and the `.client.ts` suffix are agreed, and existing Chat reuse is mandatory. Explain the history repository boundary and Q12 prompt limits before completing the design. Existing architecture diagrams were checked against this branch's unchanged application source; planned structures remain in the ticket until implemented. Prior runtime evidence is historical and does not verify this future design.
