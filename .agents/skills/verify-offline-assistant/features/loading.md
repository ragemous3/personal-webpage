# Observe loading

A visitor sees progress while the Offline assistant prepares its local resources.

## Sub-features

- `loading-cold`: a fresh profile shows actual loading progress.
- `loading-complete`: required resources reach a terminal ready state.

## How to get to it (user POV)

Open `/` in a fresh profile. Observe progress without submitting a question.

## Driving it with Puppeteer

Preconditions: working model initialization, résumé data, and browser support for the configured models. A prefilled cache cannot prove cold startup.

- **Run.** Use the [Local UI helper](../SKILL.md#local-ui-and-real-answers). Its fresh owned profile records `local-loading.png` and successive production progress states before waiting up to 600 seconds for readiness.
- **Observe.** Inspect `progress-provider >>> progress-container >>> progress` and associated labels. Require an observed nonterminal progress state, then terminal chat readiness and a real answer. The report retains the progress snapshots and model requests.
- **Complete.** Require actual terminal resource status, not merely a bar at 100 percent. The view prints status text beside completed bars. Verify the question journey before claiming answer readiness.
- **Proof.** Retain initial and terminal states and failures. An initial screenshot alone does not prove loading completion.

## Gotchas

- The chat's `[role="status"]` reports `initializing`, `ready`, `responding`, or `error`. Readiness requires retrieval, generation, restored IndexedDB history and an available runtime configuration.
- Downloads require network access even though generation is local.
- The real-model helper explicitly selects CPU/WASM. WebGPU requires a separate supported-device run. Changing the configured device or model changes what the evidence proves.
