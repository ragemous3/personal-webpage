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
| [Open and type a question](question-entry.md) | Home page `/` | Hugo/dependencies prevent a live run; component wiring needs live validation. |
| [Observe loading](loading.md) | Fresh visit to `/` | Model initialization is unfinished. |
| [Get a résumé answer](resume-answer.md) | Submit button or Enter in the input | Model initialization, response rendering, and résumé data are prerequisites. |

## Driving conventions

The form is inside `chatbot-offline-provider` then `chat-container`, each with an open shadow root. Use Puppeteer's `>>>` selectors to cross them. The current input has no accessible label; use its scoped selector until the application supplies one. Button text is `send away a question`.

Report each entry point separately. A typing check does not verify submission, retrieval, generation, or answers. A skipped path is not covered by another passing path.

Local/Online selection, cancellation, retry, and rendered history are pending product work. Add their real entry points after implementation.
