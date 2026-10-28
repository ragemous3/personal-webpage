# Open and type a question

A visitor opens the Offline assistant and enters a question about Rasmus.

## Sub-features

- `entry-open`: the home page displays a question input and submit button.
- `entry-type`: typed text remains visible before submission.

## How to get to it (user POV)

Open `/`. Wait for `ready`, click the question input, and type `What experience does Rasmus have?`.

## Driving it with Puppeteer

Preconditions: Doctor passes, the owned Hugo instance builds, and the browser renders the actual components.

- **Open.** Run the skill's `open` command. Expect title `Rasmus Moberg` and visible `chatbot-offline-provider >>> chat-container >>> input` and `chatbot-offline-provider >>> chat-container >>> button[type="submit"]`.
- **Type.** Run `type`. Inspect `after.png` and `observations.json`; expect the exact question in the input and an unchanged page URL.
- **Proof.** Compare before/after screenshots and the action log. Runtime errors that prevent usable controls fail this journey, even if the HTML contains the element names.

## Gotchas

- A plain `document.querySelector('input')` cannot reach the form through the shadow roots.
- The input and Send button remain disabled during initialization and active responses. An initialization failure must show an error and Retry.
- Typing does not prove an answer. This journey cannot close a model or response-lifecycle ticket.
