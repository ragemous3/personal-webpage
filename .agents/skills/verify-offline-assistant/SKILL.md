---
name: verify-offline-assistant
description: Verify the running personal-webpage Offline assistant through its browser UI before code review. Check prerequisites, drive mapped user journeys, retain evidence, and report blocked paths. This skill is a draft until its first successful live run.
---

# Verify the Offline assistant

**Draft: no successful live journey has been proved.** Track completion in [the verification ticket](../../../tasks/20261027-104746/TASK.md). The user chose to keep application fixes in their existing tickets. Use the terms in [GLOSSARY.md](../../../GLOSSARY.md).

The primary surface is the Hugo home page at `/`, with Lit components inside shadow roots. The configuration component offers Local and an unavailable Online placeholder; there is no online inference service. Read [the feature map](features/README.md) and select the journeys affected by the change.

## Launch

Run commands from the repository root. Restore dependencies from `package-lock.json` with `npm ci` when needed; this can download Puppeteer's browser. Discovery used Node 24.18.0. Hugo must support the [template system introduced in 0.146.0](https://gohugo.io/templates/new-templatesystem-overview/). This minimum does not establish that every later version builds the project.

Run Doctor before launching. Stop and record missing prerequisites. Discovery found Hugo 0.92.2, missing dependencies, and no `static/content-data`. A question-and-answer journey also needs the model-worker and response-lifecycle tickets completed.

The configured data files are `static/content-data/chunks.json`, `contents.bin`, and `vector-metadata.json`. They must come from the same résumé index. The generator in `scripts/create-index/` consumes `static/content-data/index.json`, produced by Hugo's JSON output. Its existing download helper removes the destination directory and uses a fixed port. Establish an isolated generation procedure before using it. Empty substitute data cannot satisfy a journey's preconditions.

After prerequisites are available, use the documented dev flags with isolated output and cache directories. The launch recipe below is not yet proved. Choose a free port for each run; if binding fails, choose another rather than stopping another process.

```bash
VERIFY_PORT=43127
VERIFY_EVIDENCE=$(mktemp -d /tmp/offline-assistant-evidence.XXXXXX)
VERIFY_SCRATCH=$(mktemp -d /tmp/offline-assistant-runtime.XXXXXX)
printf '%s\n' "$VERIFY_EVIDENCE"
git rev-parse HEAD > "$VERIFY_EVIDENCE/head.txt"
git status --short > "$VERIFY_EVIDENCE/worktree.txt"
git diff HEAD --binary > "$VERIFY_EVIDENCE/worktree.patch"
node .agents/skills/verify-offline-assistant/scripts/doctor.js > "$VERIFY_EVIDENCE/doctor.json"
```

Continue only if Doctor exits 0. Record the port, paths, and subsequent process ID.

```bash
HUGO_RESOURCEDIR="$VERIFY_SCRATCH/resources" hugo server \
  --disableFastRender --ignoreCache --noHTTPCache \
  --bind 127.0.0.1 --port "$VERIFY_PORT" \
  --baseURL "http://127.0.0.1:$VERIFY_PORT/" \
  --destination "$VERIFY_SCRATCH/public" --cacheDir "$VERIFY_SCRATCH/cache" \
  --noBuildLock --disableLiveReload \
  > "$VERIFY_EVIDENCE/server.log" 2>&1 &
VERIFY_SERVER_PID=$!
```

Use a fresh browser profile per run to isolate IndexedDB, model caches, workers, and channels. Loopback HTTP supplies a secure context, but actual WebGPU availability and model loading still need a live check. First use may download configured models from Hugging Face. No paid API is part of this path.

Launch completes only when the selected journey's UI is usable. An HTTP 200 or a server log line alone does not establish readiness. On a failed build, retain `server.log` and run Cleanup.

## Doctor

```bash
node .agents/skills/verify-offline-assistant/scripts/doctor.js
```

This read-only prerequisite check reports Hugo compatibility, declared dependencies, PostCSS CLI availability, Puppeteer's browser executable, and résumé data files. Exit 1 means prerequisites are missing; exit 0 permits a launch attempt, not a claim that the app works. It installs nothing, starts no browser or server, and downloads no models.

When an instance looks wrong, rerun Doctor, inspect the server log, and confirm the saved PID still identifies this run's Hugo command, port, and source directory. Do not attach to an unrelated server merely because it answers at the expected address.

## Drive

Use Puppeteer, already declared in `package.json`. The [observation helper](scripts/observe.js) opens a fresh profile, captures the page, and optionally types or submits through the actual form. It does not inject services or invoke internal handlers.

```bash
node .agents/skills/verify-offline-assistant/scripts/observe.js \
  "http://127.0.0.1:$VERIFY_PORT/" "$VERIFY_EVIDENCE/open" open
node .agents/skills/verify-offline-assistant/scripts/observe.js \
  "http://127.0.0.1:$VERIFY_PORT/" "$VERIFY_EVIDENCE/type" type
node .agents/skills/verify-offline-assistant/scripts/observe.js \
  "http://127.0.0.1:$VERIFY_PORT/" "$VERIFY_EVIDENCE/send" send
```

Browser execution is unproved. Each command repeats model startup in a fresh profile. Exit 0 means observations were captured, not that the feature passed. Assess the feature map's expected results. Use a persistent Puppeteer session for long model loading; wait for observed state transitions with an explicit timeout, not an assumed download duration.

## Evidence

Keep evidence separate from runtime scratch files. Record feature ID, URL, source revision and dirty/untracked changes, commands, browser/Hugo versions, preconditions, actions, expected and actual results, and verdict. Use `PASS`, `FAIL`, or `BLOCKED`; name the missing prerequisite for `BLOCKED`.

Capture the action and resulting UI, console errors, failed requests, and screenshots. Compare displayed answers with résumé source content. Check required storage or other side effects separately; an input echo or download is not proof of an answer. No user credentials or seed accounts are required.

Mocks in `tests/browser-workers.fixture.js` establish wiring behavior only. They cannot replace runtime proof. Before promoting this draft, complete one mapped journey, run Cleanup, confirm evidence still exists, and record which other journeys remain unverified.

## Cleanup

The observation helper closes only its own browser and removes only its fresh profile, including on failure. It retains the evidence directory. In the same shell session that launched Hugo, stop and wait for the saved child PID:

```bash
kill "$VERIFY_SERVER_PID"
wait "$VERIFY_SERVER_PID"
```

If resuming elsewhere, verify process identity first; a PID can be reused. Remove only this run's `VERIFY_SCRATCH` after the server exits. Keep `VERIFY_EVIDENCE`. Check that no owned server remains and reports, logs, and screenshots still exist. Repeat cleanup after failed attempts.

## Helpers

- `node .agents/skills/verify-offline-assistant/scripts/doctor.js`: read-only prerequisite report; validated against this blocked checkout.
- `node .agents/skills/verify-offline-assistant/scripts/observe.js --help`: browser command usage. Browser execution awaits the recorded prerequisites.

Update the map when implemented UI or selectors change, then rerun the affected journey. Upstream `/maintain-verification-skill` provides a maintenance workflow, but is not installed here and is not required by this draft.
