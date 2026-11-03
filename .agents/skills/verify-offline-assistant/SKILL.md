---
name: verify-offline-assistant
description: Run isolated native-browser verification of the Offline assistant, retain source-linked evidence, and distinguish controlled coordination checks from real application and model journeys.
---

# Verify the Offline assistant

Use this skill after relevant implementation and before code review, as required by [the implementation flow](../../../docs/implementation-flow.md). Use [GLOSSARY.md](../../../GLOSSARY.md). [Its ticket](../../../tasks/20261027-104746/TASK.md) records which paths have been exercised and remaining product failures.

The entry-open feature is proved on the real application in an offline initial condition. Model readiness, answer correctness and real-model cache reuse have separate requirements and are not implied by that result. Review the [feature map](features/README.md) before choosing a journey.

## Launch

Use the Node/Hugo versions and dependency installation in [production-build.md](../../../docs/production-build.md). Install Chromium or set CHROME_PATH to an executable browser. The tools also detect system Chromium/Chrome or Puppeteer's downloaded browser.

Run from the repository root. Each invocation builds the current source into its own temporary directory, starts a loopback server on a free port, and owns its browser profile. It closes those resources and preserves evidence outside the temporary directory. It never attaches to an existing browser or server.

```sh
npm run verify:browser -- --help
node .agents/skills/verify-offline-assistant/scripts/doctor.js --journey entry
npm run verify:browser -- --mode entry --evidence /tmp/assistant-entry-unique
```

Use a new evidence-directory name for every invocation. Existing evidence is never overwritten. Keep evidence outside generated site output. These commands build source; no deployment is performed.

## Doctor

`--journey entry` checks the toolchain, dependencies and browser required for the entry DOM journey. It reports missing résumé data as optional. `--journey answer` (the default) requires nonempty chunks.json, contents.bin and vector-metadata.json under static/content-data. A present file still needs consistency verification; only files from the same browser-compatible index can support real retrieval.

Doctor returns PREREQUISITES_PRESENT or BLOCKED and always sets runtimeVerified false. A prerequisite pass permits an attempt, not a feature claim. Do not invent an index or replace real models to make an application journey appear to pass.

## Drive

### Untouched application entry

`--mode entry` serves the production build unchanged and opens it in a fresh profile with external DNS blocked. It requires the actual question input and Send button to be visible through the production shadow roots, captures their state and a screenshot, and reports entry-open only. Disabled controls during initialization are expected. It does not type a question, claim model readiness or download model weights. This is an explicit offline initial condition, not a mocked service.

### Native coordination baseline

```sh
npm run verify:browser -- --mode controlled --evidence /tmp/assistant-coordination-unique
```

This mode serves the unmodified built hub and state SharedWorker in native browser contexts. Only generation/retrieval model workers are deterministic fixtures. The probe exercises transport and coordination directly, not RagService or the full question UI. Controlled outputs never establish real inference, retrieval quality or model cancellation performance.

The cases cover first-tab requests, retrieval/generation transport, joining tabs, competing claims, cancellation transport, close/crash, freeze/resume, navigation/back, worker self-close and initialization retry. Each isolated context retains native CDP target identities/counts, model-instance/initialization events and port messages. Library/internal browser targets are distinct from application workers. An exception alone is not worker termination: the self-close case also waits for the native worker target to disappear. The crash case requires a page crash event; it does not claim that only one OS process was affected.

By default, observed failures return exit 1. Add `--baseline` only when recording known current product failures. It permits completion with FAIL/BLOCKED scenarios but preserves every verdict and never permits a tool/cleanup ERROR. Do not use this option as a green product gate. Product failures belong to the runtime ticket. Future three-SharedWorker/reconnect scenarios are explicitly BLOCKED migration definitions, not passing tests of the old topology.

### Real-model cache restart

```sh
node .agents/skills/verify-offline-assistant/scripts/doctor.js --journey answer
npm run verify:browser -- --mode cache --evidence /tmp/assistant-cache-unique
```

This mode first requires the actual retrieval files. It then attempts a question with the configured real models, records Cache API URLs and persistence state, closes the browser, and restarts a new browser process with the same profile and origin. All external DNS is blocked on restart while the owned loopback site remains reachable. A second real question must complete; both model weight sets must appear in the warm cache evidence. Page request records are labelled with their scope; DNS blocking applies to worker requests too. No model download count is inferred from page-only request events.

A missing index, unsupported backend, initialization error or deadline produces BLOCKED with the concrete reason. No fixture data or models are substituted. A cache pass does not prove whole-site offline availability or protection from browser eviction. Conversation persistence is not tested by this journey.

## Evidence

The runner writes evidence.json with mode, source revision/worktree status, production worker hashes, build output, browser version, per-scenario verdicts and cleanup. Screenshots are retained locally; evidence PNGs stay ignored. Commit small evidence and runner source required to reproduce findings, not model caches, profiles or generated indices.

A scenario PASS proves only its stated observation. Keep application entry, controlled coordination and real-model results separate. Read FAIL reasons and BLOCKED prerequisites before deciding whether the implementing ticket can advance. A harness can be complete with accurately reported product failures; an implementing product ticket cannot treat those failures as passes.

The public report seam can assess an explicit observation trace:

```sh
npm run verify:browser -- --assess /tmp/observations.json
```

The input contains mode and events. Request events carry client and requestId; initialization/recovery events carry role. Reports detect stranded/misrouted work, repeated initialization, stale readiness and overlapping recovery. These reports verify supplied observations, not invisible lifecycle events. Repeated initialization is assessed within one runtime observation window, not across legitimate browser restarts. Empty, unsupported-only or identity-less observations return BLOCKED. Unmatched or duplicate terminal delivery fails, including answers leaked after the correct client has already completed. The assessment prints JSON to stdout and never writes over an input or existing report; redirect it to a new file if needed. Focused tests exercise deliberately broken traces so these failures cannot silently look successful.

## Cleanup

The runner closes its own browser contexts/browser and server and removes only its own temporary directory. Evidence remains outside that directory. A cleanup error makes the invocation ERROR. Inspect cleanup fields before accepting a run. If a process is interrupted externally, identify its recorded owned browser/profile/server before cleaning it up; never kill another instance based on a shared port or name.

## Helpers

The reusable runner is [scripts/browser-verification](../../../scripts/browser-verification). Its public command is npm run verify:browser. The older [observe.js](scripts/observe.js) helper captures an existing owned loopback instance for manual exploration; its exit code and brief capture window do not provide a feature verdict. Prefer the isolated runner for recorded verification. [Doctor](scripts/doctor.js) is read-only and starts no services.
