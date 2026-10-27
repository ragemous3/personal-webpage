# Observe loading

A visitor sees progress while the Offline assistant prepares its local resources.

## Sub-features

- `loading-cold`: a fresh profile shows actual loading progress.
- `loading-complete`: required resources reach a terminal ready state.

## How to get to it (user POV)

Open `/` in a fresh profile. Observe progress without submitting a question.

## Driving it with Puppeteer

Preconditions: working model initialization, résumé data, and browser support for the configured models. A prefilled cache cannot prove cold startup.

- **Open.** Use `open` for an initial capture. It records progress under `progress-provider >>> progress-container`.
- **Observe.** In a persistent Puppeteer session, inspect `progress-provider >>> progress-container >>> progress` and associated labels. Capture successive screenshots and console/network events. Record the selected timeout.
- **Complete.** Require actual terminal resource status, not merely a bar at 100 percent. The view prints status text beside completed bars. Verify the question journey before claiming answer readiness.
- **Proof.** Retain initial and terminal states and failures. The helper's brief observation window does not prove this full journey.

## Gotchas

- The LLM worker calls a method on an unconstructed model instance. Track its fix in [the model ticket](../../../../tasks/20261011-184042/TASK.md).
- Downloads require network access even though generation is local.
- Headless browser/WebGPU support is unverified. Changing the configured device or model would change what this run proves.
