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
npm run verify:browser -- --mode entry
```

Output defaults to a unique gitignored `artifacts/verification/<run-id>/` directory. Use `--evidence <new-directory>` to override it; existing directories are never overwritten. Keep evidence outside generated site output and disposable application/profile directories. These commands build source; no deployment is performed.

## Doctor

`--journey entry` checks the toolchain, dependencies and browser required for the entry DOM journey. It reports missing résumé data as optional. `--journey answer` (the default) requires nonempty chunks.json, contents.bin and vector-metadata.json under static/content-data. A present file still needs consistency verification; only files from the same browser-compatible index can support real retrieval.

Doctor returns PREREQUISITES_PRESENT or BLOCKED and always sets runtimeVerified false. A prerequisite pass permits an attempt, not a feature claim. Do not invent an index or replace real models to make an application journey appear to pass.

## Drive

### Untouched application entry

`--mode entry` serves the production build unchanged and opens it in a fresh profile with external DNS blocked. It requires the actual question input and Send button to be visible through the production shadow roots, captures their state and a screenshot, and reports entry-open only. Disabled controls during initialization are expected. It does not type a question, claim model readiness or download model weights. This is an explicit offline initial condition, not a mocked service. A PASS here proves only that entry controls appeared. A fresh offline profile has no model cache and may display configuration/model-option fetch errors; record those errors and do not present its screenshot as a successful Local answer. Use the cache journey or the speech journey's Local/returning-Local screenshots for answer evidence.

### Native coordination baseline

```sh
npm run verify:browser -- --mode controlled
```

This mode serves the built RuntimeCoordinator and all three native application SharedWorkers in native browser contexts. Only generation/retrieval model drivers are deterministic fixtures; their SharedModelRuntime adapter is production code. The application reconnect scenario uses a labelled chunk fixture. The probe exercises transport and coordination directly, not RagService or the full question UI. Controlled outputs never establish real inference, retrieval quality or model cancellation performance.

The cases cover first-tab requests, retrieval/generation transport, joining tabs, simultaneous attachment, cancellation transport, close/crash, freeze/resume, navigation/back, worker self-close and initialization retry. Each isolated context retains native CDP target identities/counts, model-instance/initialization events and port messages. Library/internal browser targets are distinct from application workers. An exception alone is not worker termination: the self-close case also waits for the native worker target to disappear. The crash case requires a page crash event; it does not claim that only one OS process was affected.

By default, observed failures return exit 1. Add `--baseline` only when recording known current product failures. It permits completion with FAIL/BLOCKED scenarios but preserves every verdict and never permits a tool/cleanup ERROR. Do not use this option as a green product gate. It does not create an approved screenshot/test baseline or authorize committing run output. Product failures belong to the runtime ticket. The three-SharedWorker, queued-cancellation, recovery and reconnect scenarios now run against this architecture. A missing observation is not a pass.

### Real-model cache restart

```sh
node .agents/skills/verify-offline-assistant/scripts/doctor.js --journey answer
npm run verify:browser -- --mode cache
```

This mode first requires the actual retrieval files. It then attempts a question with the real models, records Cache API URLs and persistence state, closes the browser, and restarts a new browser process with the same profile and origin. All external DNS and the local model-download route are blocked on restart while application, WASM and retrieval assets remain served. The local model endpoint records worker downloads; a returning answer must make zero model requests. A second real question must complete; both model weight sets must appear in the warm cache evidence. Page request records remain labelled with their scope. The local endpoint count covers worker fetches as well.

A missing index, unsupported backend, initialization error or deadline produces BLOCKED with the concrete reason. No fixture data or models are substituted. Set RUNTIME_MODEL_DIR to a local model mirror for isolated WASM/one-thread/32-token deterministic configuration; production defaults remain unchanged. The cache journey also checks real answers in two tabs, continued work after closing one, Cancel and Reset. A cache pass does not prove whole-site offline availability or protection from browser eviction. Conversation persistence is not tested by this journey.

## Local UI and real answers

```sh
node .agents/skills/verify-offline-assistant/scripts/doctor.js --journey answer
RUNTIME_MODEL_DIR=/path/to/model-mirror node --import tsx .agents/skills/verify-offline-assistant/scripts/local.js
```

This owned helper reuses the production-build, model-mirror, browser and cleanup infrastructure. It uses real generation/retrieval, CPU/WASM and a 32-token budget. A fresh isolated profile records cold progress, exact typed text, separate Send/Enter answers grounded in the résumé's Ericsson fact, reload history and fresh-tab isolation. A new browser process then answers from the same cache with external DNS and model download routes blocked. Application, WASM and retrieval files remain served locally. The helper does not enable speech, verify WebGPU, exercise cancellation/retry or prove whole-site offline availability.

Evidence includes local-loading.png, typed-button.png, typed-enter.png, local-answer.png, local-enter-answer.png and local-returning-answer.png. The report records the application source digest and helper digest. Evidence remains in a unique ignored run directory after owned browser/server/profile teardown. Run the separate speech journey for native voice and mouth-animation observations.

## CPU cancellation and throughput

```sh
RUNTIME_MODEL_DIR=/path/to/model-mirror npm run verify:browser -- --mode performance
```

This compares the production shared generation path with the same handler, actual Qwen model, prompt, backend and generation settings in a dedicated Worker without cooperative task yields. It checks identical outputs, retains one warm-up plus three measured answers per topology and measures actual cancellation stop acknowledgment. Report sample variation; do not turn CPU measurements into a hardware-wide or WebGPU guarantee. See [the runtime explanation](../../../docs/runtime-coordinator.md) for mirror layout and reproducible browser-compatible retrieval data preparation.

## Evidence

The runner writes evidence.json with mode, source revision/worktree status, production worker hashes, build output, browser version, per-scenario verdicts and cleanup. Commit the skill, feature map, helper scripts, tests, fixtures and approved test baselines. Routine screenshots, videos, traces, logs and reports belong in run artifacts. Follow [the evidence storage policy](../../../docs/verification-evidence.md): publish accessible PR/CI artifact or durable archive links, with the tested SHA, commands, outcomes, skipped checks and retention. Workspace-only output is local-only evidence, not shared review evidence. Historical reports are linked at immutable Git revisions; they are not retained in the current tree.

A scenario PASS proves only its stated observation. Keep application entry, controlled coordination and real-model results separate. Read FAIL reasons and BLOCKED prerequisites before deciding whether the implementing ticket can advance. A harness can be complete with accurately reported product failures; an implementing product ticket cannot treat those failures as passes.

The public report seam can assess an explicit observation trace:

```sh
npm run verify:browser -- --assess /tmp/observations.json
```

The input contains mode and events. Request events carry client and requestId; initialization/recovery events carry role. Reports detect stranded/misrouted work, repeated initialization, stale readiness and overlapping recovery. These reports verify supplied observations, not invisible lifecycle events. Repeated initialization is assessed within one runtime observation window, not across legitimate browser restarts. Empty, unsupported-only or identity-less observations return BLOCKED. Unmatched or duplicate terminal delivery fails, including answers leaked after the correct client has already completed. The assessment prints JSON to stdout and never writes over an input or existing report; redirect it to a new file if needed. Focused tests exercise deliberately broken traces so these failures cannot silently look successful.

## Cleanup

The runner closes its own browser contexts/browser and server and removes only its own temporary directory. Evidence remains outside that directory. After teardown, finalization checks the report and every declared artifact for readability and nonempty file contents. `evidenceRetained` becomes true only after those checks; missing evidence or a cleanup error makes the invocation ERROR. Inspect cleanup fields before accepting a run. If a process is interrupted externally, identify its recorded owned browser/profile/server before cleaning it up; never kill another instance based on a shared port or name.

## Publishing routine runs

`npm run verify:browser -- --mode online` verifies the production UI and browser OnlineChatClient through the real Express API and OpenAI SDK against a controlled OpenAI HTTP endpoint. Retrieval and Local inference are labelled fixtures. It requires no credentials and covers streaming, cancellation, explicit retry, reset, failure, mode switching, shared retrieval reuse, reload restoration and fresh-tab history isolation. Initial Online startup must have only the coordinator and retrieval SharedWorkers. This is not live OpenAI inference or a real-model performance check. The manual workflow accepts `online` and retains the report and screenshot for 90 days. Server source is included in the evidence digest. See [Online generation](../../../docs/online-assistant.md).

The Online journey holds Local pipeline initialization at a controlled HTTP gate, switches Online and completes an API answer while the Local resource remains loading. It releases the gate in teardown. This checks that mode changes and Online answers do not depend on Local initialization completing.

The manual Browser verification workflow publishes entry/controlled reports and screenshots with 90-day retention; ordinary CI uploads test execution output even after test failure. Artifact links are included in the workflow summary. Real-model cache/performance runs need their existing local prerequisites and a separately published artifact/archive link. Record results and skipped/unattempted checks concisely in the ticket; do not commit routine reports or scratch notes. Approved baselines stay under reviewed test assets, outside the ignored artifact directory.

## Helpers

The reusable runner is [scripts/browser-verification](../../../scripts/browser-verification). Its public command is npm run verify:browser. The skill-owned [Local UI helper](scripts/local.js) adds the typing, Enter and history observations described above. The legacy observe.js helper has obsolete provider traversal and is not a supported recipe for the current application. Use the isolated runners for recorded verification. [Doctor](scripts/doctor.js) is read-only and starts no services.

## Persisted assistant settings

`npm run verify:browser -- --mode settings` builds the production application with controlled model drivers and a labelled retrieval fixture. It seeds saved Online/CPU preferences before startup, verifies zero model initialization until Local is selected, and exercises two-tab settings propagation, edits during an accepted response, cancellation, retained conversation history, forced WebGPU failure with explicit switch-back, and returning-page preferences. Reports and a screenshot remain in the ignored run directory. This proves UI/coordination behavior, not real inference or hardware support. The manual Browser verification workflow accepts `settings` to publish this evidence with 90-day retention.

With RUNTIME_MODEL_DIR set, the real cache journey seeds explicit Local/CPU preferences and a 32-token budget before the first production application load. It keeps saved settings on restart. This controlled verification setup preserves production defaults and still uses real generation, retrieval and cached model weights.

The settings journey uses labelled model metadata fixtures and checks discovered variants against the revision submitted to the generation worker. It changes precision through the actual controls before the existing history, drain and recovery checks. The real-model mirror must contain files under the configured pinned revision; verify its Q4 LFS SHA-256 and the config/tokenizer Git blob hashes against that revision before linking existing local files into that directory. A successful controlled journey does not prove real weights or hardware support.

## Talking head and browser speech

Use `npm run verify:browser -- --mode speech` for the [talking-head prototype](../../../docs/talking-head.md). It uses real MPFB/TalkingHead rendering and native speechSynthesis in both modes, with controlled generation/retrieval by default. RUNTIME_MODEL_DIR adds real Local models. The journey checks text-to-utterance correspondence, Stop/Reset, Local mode changes, zero dedicated speech Workers and returning-browser behavior with external DNS blocked. With no available system voices, it continues through text/error paths but reports BLOCKED for native audible output. Voice availability and offline behavior depend on the browser/operating system.

Text-driven mouth animation uses estimated timing and native word-boundary alignment where available. Verify visible motion with a real voice or clearly labelled controlled events; the latter cannot prove audible synchronization. The journey retains screenshots, video and native-event observations, not a synthesized PCM/WAV file or neural voice-cache evidence. Routine artifacts remain ignored and the manual speech workflow retains published artifacts for 90 days. Live OpenAI and visitor-device performance remain separate checks.
