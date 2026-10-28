# Get a résumé answer

A visitor submits a question and reads an answer supported by résumé content. The Offline assistant uses Retrieved context as evidence for its answer.

## Sub-features

- `answer-button`: submit with the button and receive a visible answer.
- `answer-enter`: submit with Enter and receive a visible answer.
- `answer-grounding`: factual claims agree with the résumé content.

## How to get to it (user POV)

Open `/`, wait for `ready`, type a question, then click `Send` or press Enter in the input.

## Driving it with Puppeteer

Preconditions: loading completes; matching chunks, vectors, and metadata exist; both model backends initialize successfully.

- **Choose evidence.** Read `content/experience.md` and `content/employment.md`. Identify résumé facts against which to check the helper's question: `What experience does Rasmus have?`.
- **Button.** Run `send`. The helper types through the input and clicks the actual button. Capture the question, request failures, navigation, and visible result.
- **Keyboard.** Run the same command with `enter` instead of `send`. Assess this entry point independently.
- **Answer.** Expect one user message and one assistant message inside `[role="log"]`, with no accidental navigation. Observe successive text updates and the terminal `ready` status. Check the displayed answer against the résumé source.
- **Cancel and retry.** Submit another question and click `Cancel` during generation. The partial answer must stay visible and read `interrupted`. Click `Retry`; the failed assistant attempt is replaced without adding another user question.
- **Reset.** Click `Reset` during a response. The log must remain empty even if late worker callbacks arrive. Submit a fresh question once ready.
- **Proof.** Preserve both actions and results. A console response or input echo does not count as an answer.

## Gotchas

- Exercise the form rather than bypassing it through service calls. Browser fixture tests establish view behavior but do not prove real model execution.
- Missing data blocks this journey. Mocking the model or inserting answer DOM would not prove it.
