# Handle model context limits for persisted chat history

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

Handle conversations whose complete saved history no longer fits the active model or API request limits. The user explicitly deferred this complexity from the Local/Online chatbot refactor; no rolling-window or summarization policy has been approved.

RagService currently includes completed earlier turns in its prompt. The application API currently accepts at most 40 messages, 32,000 characters per message, and 128 KiB of JSON. Model token/context limits are a separate constraint. IndexedDB persistence permits conversations to outgrow these limits without implying that stored history should be deleted.

**What to build:** an agreed projection of saved conversation history into a valid generation request for the selected Local or Online model, while preserving the complete saved/displayed conversation.

**Demo path:** continue a saved conversation beyond the active input limit, observe the agreed context-management behavior, and verify that its complete stored history remains available after switching modes and reopening it.

## Prerequisites

- Current stage: queued for design. No implementation mode, branch or context-management policy has been selected.
- Complete the prerequisite chat-history and injected chat-client foundation.
- Agree whether to use a recent-turn window, explicit visitor action, summarization, or another strategy. Do not assume automatic trimming or introduce another model/provider silently.
- Establish supported model context capacities, tokenizer availability, reserved output/reasoning budget, API message/byte bounds and behavior when the current question plus retrieved context alone is too large.
- Reuse RagService orchestration, the existing prompt model and client/model-capability contracts where they fit.

## Acceptance criteria

- [ ] The selected history-projection policy is documented and user-approved before implementation, including its effect on what earlier details can influence an answer.
- [ ] Generation requests respect the active model's established input/context budget and the application's API message, per-message and encoded-body limits. Output/reasoning reservations are accounted for where applicable.
- [ ] The full stored and displayed conversation is preserved; changing the model request does not delete, rewrite or summarize persisted history implicitly.
- [ ] Current questions, trusted instructions and retrieved evidence follow the agreed priority and oversized-input behavior. Any omitted or summarized history follows the approved policy.
- [ ] Local/Online switches use the destination model's supported limits and cannot reuse stale capability information or mutate an already accepted response's prompt.
- [ ] Boundary checks cover below/at/above limits, complete turn ordering, multibyte payload sizes, interrupted messages, unknown capabilities and an oversized current question/context.
- [ ] Actual application verification demonstrates the approved behavior for a long saved conversation and confirms that saved history remains intact. Controlled checks and real-model results are distinguished accurately.

## Dependencies

**Blocked by:** [Switch Local and Online chatbot trees through dependency injection](../20261105-222408/TASK.md), specifically its chat-history persistence and common injected chat-client boundary.

Related: [chat-log selection](../20261106-125405/TASK.md). Selecting a saved conversation is not a technical prerequisite for applying a history projection.

## Definition of Done

- [ ] Policy, public test seams, check commands and runtime verification are agreed through the implementation flow.
- [ ] All acceptance criteria pass focused checks, relevant browser/model journeys, independent reviews and the final full suite.
- [ ] Relevant service and whole-application diagrams in docs/architecture/ reflect the implemented responsibility and use the required naming and border styles.
- [ ] Concise source-linked evidence is recorded; routine reports/screenshots remain retained artifacts rather than tracked repository files.
