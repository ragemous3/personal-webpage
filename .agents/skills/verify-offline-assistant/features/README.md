# Offline assistant verification map

This map describes the existing home-page surface. It is a draft with no successful live run. Read the selected feature before driving the app.

## Baseline preconditions

- Follow Launch and Doctor in [the skill](../SKILL.md).
- Use a unique loopback port, disposable browser profile, and runtime directory.
- Retain evidence separately and record the source revision.
- The configured models and matching résumé data must load for answer verification. There are no accounts to seed.

## Features

| Feature | Entry point | Current limitation |
| --- | --- | --- |
| [Open and type a question](question-entry.md) | Home page `/` | Input is disabled until both workers report ready. |
| [Observe loading](loading.md) | Fresh visit to `/` | The configured WebGPU models require an available GPU adapter. |
| [Get a résumé answer](resume-answer.md) | Send button or Enter in the input | Matching résumé data and working model backends are required. |

## Driving conventions

The form is inside `chatbot-offline-provider` then `chat-container`, each with an open shadow root. Use Puppeteer's `>>>` selectors to cross them. The input has accessible label `Question`. The submit button is `Send`. Observe `[role="status"]`, `[role="alert"]`, and `[role="log"]` within the chat shadow root. `Cancel` interrupts a response; `Reset` clears the conversation. `Retry` appears after an error and requires an explicit click.

Report each entry point separately. A typing check does not verify submission, retrieval, generation, or answers. A skipped path is not covered by another passing path.

Local/Online selection is pending product work. Rendered history, cancellation, reset, and retry are part of the shared response lifecycle; verify each affected action against the real model before claiming a full journey.
