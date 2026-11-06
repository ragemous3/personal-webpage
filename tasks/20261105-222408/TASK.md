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

### Revised responsibility plan

1. Shared composition supplies the configuration service and per-tab conversation state above both mode-specific trees. Settings controls remain mounted while a response drains or a tree changes.
2. A chatbot host view subscribes to configuration state and renders the Local or Online child tree. Render the active, acknowledged mode after accepted work drains; changing the selected mode alone must not prematurely unmount a responding tree. Keep network, model lifecycle and persistence logic out of the host view.
3. Offline and Online composition supply their respective data implementations through common contracts. Reuse the existing chat controls and RagService behavior rather than duplicating response orchestration or UI logic. Instantiate only the active tree's generation dependencies.
4. The Local tree retains worker-based generation, streaming, confirmed cancellation and model caching. The Online tree uses a new data repository that calls the Express API directly from the browser, including streamed output and AbortSignal cancellation. HTTP generation must no longer be selected inside the language-model worker or require its shared generation queue.
5. Reuse ApiBase as the Online repository's base where applicable. It currently provides JSON and byte reads, not generation POST streaming. Extend its request capability without breaking its existing consumers; keep URL, HTTP and stream parsing details in data implementations.
6. Browser résumé retrieval stays available to both trees. Reuse its existing shared retrieval infrastructure deliberately. Keep general shared configuration and accepted-response coordination separate from Local-only generation resource readiness.
7. Keep history outside the lifetime of either mounted tree. Existing RagService disposal resets its own history; replacing the tree must dispose its subscriptions and transports without losing the shared conversation. Reset remains the explicit conversation-clearing action.
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
- [ ] Selected mode changes wait for accepted responses to finish, fail or be explicitly cancelled before changing the mounted active tree. Rapid changes coalesce, and stale completions cannot reattach an older tree.
- [ ] The same per-tab conversation survives Local/Online tree disposal and remount. Reset explicitly clears it, and late output cannot repopulate it.
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
- Runtime model mirror and compatible résumé index are local verification prerequisites. Credentials are explicitly unavailable and waived for this implementation.

## Definition of Done

- [ ] The revised architecture and final seam/check mapping are recorded in this ticket.
- [ ] Acceptance criteria pass focused and integration checks on the new branch.
- [ ] Runtime verification exercises the switched trees; cleanup, both independent reviews, blast-radius assessment and the final suite apply to the replacement implementation SHA. Prior reviews and test results are historical and invalidated for this architecture change.
- [ ] All intended skill/workflow/architecture changes are committed with the replacement. Routine verification screenshots/reports remain ignored artifacts with accessible links and retention.
- [ ] The new branch is published with its own unmerged PR, an accurate description and updated saved diagrams. Record its PR URL and closure on this branch after handoff.
