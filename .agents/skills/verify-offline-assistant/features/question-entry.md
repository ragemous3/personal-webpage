# Open and type a question

A visitor opens the Offline assistant and enters a question about Rasmus.

## Sub-features

- `entry-open`: the home page displays a question input and submit button.
- `entry-type`: typed text remains visible before submission.

## How to get to it (user POV)

Open `/` and verify the visible form for entry-open. For entry-type, wait for `ready`, click the question input, and type `What experience does Rasmus have?`.

## Driving it with Puppeteer

For entry-open, Doctor --journey entry passes and the owned production build renders the actual components. Run npm run verify:browser -- --mode entry --evidence <new-directory>. The offline initial condition permits disabled controls and proves only the visible entry surface. For entry-type, Doctor --journey answer passes and both model resources must actually reach ready.

- **Run.** Use the [Local UI helper](../SKILL.md#local-ui-and-real-answers). It builds an isolated production application with real models and matching résumé data.
- **Open and type.** Require a visible input, terminal `ready` state, an enabled input and a disabled empty Send button. Type the question and require its exact value, enabled Send and an unchanged URL.
- **Proof.** Inspect `typed-button.png`, `typed-enter.png` and `evidence.json`. Runtime errors that prevent usable controls fail typing, even if the HTML contains the element names.

## Gotchas

- A plain `document.querySelector('input')` cannot reach the form through the shadow roots.
- The input and Send button remain disabled during initialization and active responses. Runtime failures show `reconnect`; other chat errors show `Retry`, or `Retry saving` for storage failures. Settings initialization has its own recovery controls.
- Typing does not prove an answer. This journey cannot close a model or response-lifecycle ticket.
