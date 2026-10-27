# Get a résumé answer

A visitor submits a question and reads an answer supported by résumé content. The Offline assistant uses Retrieved context as evidence for its answer.

## Sub-features

- `answer-button`: submit with the button and receive a visible answer.
- `answer-enter`: submit with Enter and receive a visible answer.
- `answer-grounding`: factual claims agree with the résumé content.

## How to get to it (user POV)

Open `/`, type a question, then click `send away a question` or press Enter in the input.

## Driving it with Puppeteer

Preconditions: loading completes; matching chunks, vectors, and metadata exist; the application renders responses. These conditions are not currently met.

- **Choose evidence.** Read `content/experience.md` and `content/employment.md`. Identify résumé facts against which to check the helper's question: `What experience does Rasmus have?`.
- **Button.** Run `send`. The helper types through the input and clicks the actual button. Capture the question, request failures, navigation, and visible result.
- **Keyboard.** Run the same command with `enter` instead of `send`. Assess this entry point independently.
- **Answer.** Expect a visible answer and no accidental navigation. There is currently no answer element, so this step is blocked. After response rendering is implemented, record its actual selector and check its displayed text against the résumé before promoting this recipe.
- **Proof.** Preserve both actions and results. A console response or input echo does not count as an answer.

## Gotchas

- [Model initialization](../../../../tasks/20261011-184042/TASK.md) and [response rendering](../../../../tasks/20261022-202009/TASK.md) remain prerequisites.
- The submit binding currently returns a handler rather than invoking it. Exercise the form rather than bypassing it through service calls.
- Missing data blocks this journey. Mocking the model or inserting answer DOM would not prove it.
