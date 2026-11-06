# Enable full online assistant mode through an application API for OpenAI

- STATUS: CLOSED
- PRIORITY: 200
- TAGS: task

## Background

Enable full online assistant mode through an application API that calls OpenAI. The user selected this as the next implementation topic, ahead of the coordinator reconnect investigation, and requested grill-with-docs before implementation.

Today Online is persisted but unavailable and disables Send. The existing settings ticket explicitly excluded online inference. This is a distinct extension of that feature, not a reopening of its completed Local-mode work.

**What to build:** a visitor selects Online, retrieves relevant résumé passages in the browser, and receives an OpenAI-generated answer through the application's Node.js/Express/TypeScript API. Keep provider-specific integration replaceable so additional providers and models can be supported later.

**Demo path:** start with saved Online preferences in a fresh browser profile, retrieve relevant passages and receive a streamed real online answer. Observe retrieval-resource downloads but no local generation-model download. Verify that the browser calls the application API and never receives an OpenAI credential. Cancel an answer, retain its partial text, explicitly retry, and switch modes while preserving history. An accepted response finishes before a pending mode change applies, unless the visitor explicitly cancels it.

Keep this as one end-to-end feature ticket, as requested. Backend setup alone does not complete it. Provider extensibility is part of the design; delivering a second provider is not an agreed requirement.

## Prerequisites

- Current stage: stage 7, PR handoff; implementation complete. The user confirmed the design by requesting implementation under Autopilot on 2026-11-06.
- Mode: Autopilot through PR handoff, scoped to implementation, routine design details, tests and data preparation, documentation/ticket updates, cleanup, independent reviews, signed commits, branch push, PR creation and CI/review fixes. Merge and deployment require separate authorization.
- Branch: feature/20261105-222408-online-generation. Fixed review base: df7fd5597ec6613af55ddba4506ca61ce6109e7c. Latest implementation: ac22203a9ddd0d759712d1b5a8eed6195d41a3ae. Both independent reviews PASS at that SHA; final npm test PASS with 147 tests, zero failures/skips.
- Finish condition: verified implementation and PR handoff. The user explicitly stated no credentials are available and authorized implementation without them. Replace the live OpenAI verification requirement with a controlled OpenAI HTTP endpoint covering the complete browser-to-Express path; report actual project access and real model output as unverified.
- Agreed Q1 (2026-11-06): the API belongs to this application, runs locally during development and is hosted for website visitors. Browser requests go through this API to OpenAI; credentials stay server-side. Hosting provider remains undecided.
- Agreed Q5 (2026-11-06): preserve the existing response controls in both modes, including streaming, Cancel, Reset and applicable recovery actions. Keep conversation history across mode changes and finish accepted responses before applying a pending mode change. Online cancellation requests upstream cancellation; already generated tokens may still incur cost.
- Inspection confirms the current chat component already has Cancel and Local-mode cancellation is implemented, with lifecycle regression tests. Extend the same control to Online and verify both paths; no duplicate Cancel control is needed.
- Agreed Q3, revised by the user's Q10 decision (2026-11-06): public visitors use the site owner's OpenAI account without providing their own keys. The owner handles the OpenAI plan/credits. Application usage policies, rate quotas, spending ceilings and accounting infrastructure are outside this ticket.
- Agreed Q2 (2026-11-06): only generation moves online for now. Retrieval remains in the browser with its embedding model and résumé index. Online therefore still requires browser retrieval resources; it does not require the local generation model. Backend retrieval is outside this ticket.
- Agreed Q4 (2026-11-06): support additional AI providers and models through replaceable integrations; keep conversation handling and retrieval independent of the provider. Implement OpenAI first.
- User-selected backend technology (2026-11-06): Node.js, Express and TypeScript.
- Agreed Q6 (2026-11-06): send the question, relevant conversation history and retrieved passages to the API. The server supplies trusted assistant instructions and validates request shape, size and supported parameters. These correctness checks are separate from the excluded usage policies. History remains in the tab, with no server-side conversation persistence initially.
- Agreed Q7 (2026-11-06): keep the backend in this repository and expose it through the website's /api route, with an equivalent local development setup. Hosting provider remains undecided.
- Agreed Q8 (2026-11-06): the server defines allowed Online models and their supported settings, and the browser fetches those choices. Displayed choices must match what the API accepts. Reuse the existing browser RagService, retrieval and conversation handling, injecting Local or Online generation through DI. Use abstract classes to share core behavior. Running local models on the Node server is outside this scope.
- Agreed Q9 (2026-11-06): retain partial output on Online failure and offer explicit Retry. Do not automatically switch provider or mode, or silently replay a paid request.
- Agreed Q10 (2026-11-06): focus on correct OpenAI integration; do not add usage-policy services, visitor tracking for quotas, a budget repository, spending reservations or credit management. The earlier numerical limits and accounting proposal are withdrawn. OpenAI quota/billing errors still follow the normal explicit-error/retry behavior; the application makes no spending-cap guarantee.
- Agreed Q11 (2026-11-06): remain deployment-provider-neutral. Express runs locally and can be hosted behind the site's /api route. Selecting a hosting service or deploying is not required for this ticket's implementation handoff.
- User-selected Q12 (2026-11-06): GPT-6 Luna with low reasoning effort. Verified against the [official model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna): API model gpt-6-luna supports reasoning.effort low through the Responses API. Use this configured initial model and effort; do not silently substitute another model. Actual project/model access remains unverified without credentials.
- Agreed Q13, revised by the credential-free implementation instruction (2026-11-06): require actual browser checks for streaming, Cancel, Retry, Reset and mode switching. The real OpenAI response requirement is replaced by the approved controlled HTTP alternative described above.

### Implementation design and verification mapping

The user confirmed the combined plan by requesting implementation under Autopilot. Keep all three native SharedWorkers. RuntimeCoordinator retains leases, routing and response-boundary configuration changes. Its generation worker selects LocalLLMData or OnlineGeneration behind GenerationAbstract. RagService, conversation handling and retrieval are reused. The Node server injects OpenAIProvider through GenerationProviderAbstract. The model catalogue remains independent of preference persistence.

The Express API accepts at most 40 user/assistant messages, each at most 32,000 characters, within a 128 KiB JSON request. It supplies server-owned instructions and rejects client system roles and unsupported models/output limits. A two-minute operation deadline and browser disconnect abort the upstream request. SDK retries are disabled. These are input/operation correctness bounds, not usage quotas.

- API and provider seam: tests/online-api.spec.js tests real HTTP boundaries, outbound Responses model/effort/instructions/store settings, validation, streaming failure and cancellation. Controlled HTTP responses cannot prove project/model access.
- Generation stream seam: tests/online-generation.spec.js verifies text, split UTF-8/JSON, completion, truncation and failure without silently accepting partial streams.
- Settings seam: tests/online-settings.spec.js verifies API-derived choices, retained Local preferences, saved Online startup and unavailable catalogue recovery.
- Regression seams: tests/configuration-service.spec.js, tests/runtime-configuration-adapter.spec.js, tests/chat-lifecycle.spec.js, tests/llm-worker.spec.js and tests/offline-config.spec.js cover existing settings, leases, cancellation, history and Local startup.
- Focused command: node --import ./scripts/typescript-test.loader.js --test tests/online*.spec.js tests/configuration-service.spec.js tests/runtime-configuration-adapter.spec.js tests/chat-lifecycle.spec.js tests/llm-worker.spec.js tests/offline-config.spec.js. Integration commands: npm run typecheck, npm run lint, npm run build. Final npm test follows both independent reviews.
- Actual application journeys: npm run verify:browser -- --mode online and --mode settings, using clearly labelled model/provider fixtures. The online journey crosses the production handler, Express and OpenAI SDK. A real Local CPU/Auto/cache journey checks the shared generation refactor using the existing compatible mirror and index.

## Acceptance criteria

- [x] Selecting Online enables an end-to-end assistant response through the application's API and OpenAI, using the agreed content and conversation policy.
- [x] OpenAI credentials remain server-side and are absent from browser assets, browser storage and client responses.
- [x] Online retrieves relevant résumé content in the browser and calls the application API only for generation, without starting or downloading the local generation model for an Online-only session.
- [x] The backend uses Node.js, Express and TypeScript, with OpenAI behind a replaceable provider integration. Existing browser conversation and retrieval services are reused through injected generation dependencies, with abstract classes sharing core behavior.
- [x] Local and Online settings identify the actual selected model and supported choices; switching follows the agreed conversation and in-flight response policy.
- [x] Online model choices and supported settings come from the server's allowed configuration and match API validation. DI permits replacement of provider integrations, and abstract classes share core behavior at the reuse boundary confirmed during design.
- [x] The initial Online configuration uses gpt-6-luna with reasoning.effort low through the OpenAI Responses API. Tests check the actual outbound model and effort, and the UI reflects this configuration accurately.
- [x] Local and Online share the existing Send, Cancel, Reset and applicable recovery controls. Online streams output; Cancel retains partial text and requests upstream cancellation. Reset clears the tab's conversation and prevents stale output from repopulating it. Local cancellation remains functional.
- [x] Switching mode preserves the conversation and waits for accepted responses to complete, fail or be explicitly cancelled before applying the new selection. Late output from an old request cannot change the active conversation.
- [x] The API accepts the question, bounded relevant history and retrieved passages, supplies trusted server-side assistant instructions, and validates inputs before contacting the provider. Conversation history is not persisted by the backend.
- [x] The backend lives in this repository, with a same-origin /api route and a documented equivalent development setup.
- [x] An Online failure preserves partial output and permits explicit Retry without automatic provider/mode fallback or silent paid-request replay; API and browser tests verify this behavior.
- [x] The agreed development and deployment setup can run the API with server-side OpenAI configuration. No application usage-policy or spending-accounting infrastructure is introduced.
- [x] Browser verification demonstrates streaming, Cancel, Retry, Reset and mode switching through the Express API and a controlled OpenAI HTTP endpoint. A real credentialed OpenAI response is explicitly unverified under the user's approved alternative.

## Dependencies

**Blocked by:** None. Design and implementation mode are confirmed. The approved controlled HTTP alternative removes credentials as a blocker to handoff.

- [Persisted assistant settings](../20261028-123834/TASK.md), CLOSED and merged in PR #22; supplies the mode selector and preferences.
- [RuntimeCoordinator lifecycle](../20261029-193942/TASK.md), CLOSED; supplies existing Local-mode contracts to preserve or explicitly revise.
- OpenAI project credentials and gpt-6-luna access for a future live check: not available, explicitly waived for this implementation. Never record secret values in this ticket. Hosted deployment is not a prerequisite.
- [Coordinator reconnect investigation](../20261105-222407/TASK.md) is scheduled afterward and is not a blocker.

## Definition of Done

- [x] User confirms the design and verification plan, and this planning ticket is refined to observable agreed criteria before implementation.
- [x] All approved acceptance criteria pass focused tests and actual application journeys; limitations are explicit.
- [x] Required type, lint, build, independent reviews and final full-suite checks pass through docs/implementation-flow.md.
- [x] Reusable verification tooling is committed; routine run evidence is retained as artifacts under docs/verification-evidence.md.

### Stages 3–4 verification

Implementation, cleanup and runtime verification complete; next is the signed snapshot and independent Standards/Spec reviews against fixed base df7fd5597ec6613af55ddba4506ca61ce6109e7c. No final full-suite result is claimed before those reviews.

- Focused command above: 74 PASS, zero failures. npm run lint, npm run typecheck, npm run build, actionlint for the verification workflow, and git diff --check pass. Doctor reports PREREQUISITES_PRESENT after correctly resolving the added type-only dependency packages.
- Online browser journey PASS: artifacts/verification/online-2026-11-06T06-25-53-574Z-5b9428bb-a710-41a8-bb83-f47e9f321763/. Real Express/OpenAI SDK and production UI/handler with controlled provider HTTP and model fixtures. Includes startup without Local generation, server model choice, streamed output, Cancel, Retry, Reset, partial failure, Local generation and switching back. Earlier development failures exposed native fetch binding and select rendering issues; those runs are retained as FAIL, not counted as passes.
- Existing two-tab settings journey PASS: artifacts/verification/settings-2026-11-06T06-25-58-271Z-29f297e2-52cb-4fbc-b453-7a9308ca00b1/.
- Real Local CPU/Auto/cache journey PASS: artifacts/verification/cache-2026-11-06T06-26-25-071Z-42ee58f8-bd80-440e-8be6-df8351471032/. Tests actual inference, two-tab/surviving-tab behavior, Cancel/Reset, requested Auto and CPU restoration, and browser restart with zero returning model requests. This does not prove live OpenAI access or factual answer quality.
- All three reports match the implementation source digest; cleanup closes owned browsers/servers, removes scratch and retains evidence. Reports/screenshots are ignored local artifacts pending hosted publication. No run output is committed.

### Stage 5 findings

Standards review at 70aae80164482cefab928e5e0d0b4e0db8324545 found missing responsibility suffixes in the new server filenames and a duplicated OnlineModel DTO. Return to stage 3 to align filenames and reuse the shared type. Both review results, blast-radius review and final-suite evidence are invalidated for the fix. The independent Spec review is still assessing that original snapshot.

Spec review at that snapshot PASS with zero findings. The Standards fixes align the server/verification factory filenames, extract GenerationProviderAbstract and reuse the shared OnlineModel DTO through type-only imports. Lint, TypeScript and the ten Online focused checks pass. The final Online browser journey passes at artifacts/verification/online-2026-11-06T06-32-57-998Z-63b599bb-4b73-4718-9558-8b8051b1a130/ and matches the complete revised source digest. Earlier settings and real Local cache reports remain valid for their recorded snapshot; all three production worker hashes are byte-identical to this final build. No inference behavior changed in the naming/type fix, so the heavy Local journey is not repeated. Cleanup passes. Next: sign the revised snapshot and repeat both independent reviews.

### Stages 5–7

Independent Standards and Spec reviews both PASS at ac22203a9ddd0d759712d1b5a8eed6195d41a3ae against the fixed review base, with zero unresolved actionable findings. Source digest: a61ee5df646706ccf73a5ca5b15db4071920c44ad5b82ed4cc87a4514ed2b2c3. The final Online report matches this digest.

Blast radius: no bulk or destructive live-data operation applies. Preference schema remains version 1 with an optional Online model field; unrelated storage and cached weights are preserved. Conversation history is not persisted server-side. Verification owns its disposable browsers, profiles and servers and preserves routine evidence outside cleanup. No credentialed external inference or deployment was performed.

Stage 7 entered: final npm test after both reviews is running. Next: record its result, sign metadata, push and open a PR, publish browser artifacts with 90-day retention, and close this ticket for handoff. Merge and deployment remain unauthorized. The reconnect ticket remains OPEN and scheduled after this feature.

Final full-suite result: npm test PASS, 147 tests, zero failures/skips, after both independent reviews at implementation ac22203a9ddd0d759712d1b5a8eed6195d41a3ae. The prepared PR describes this snapshot. Current source is unchanged apart from ticket records. Publication is authorized by the Autopilot grant; proceed to branch push, PR and artifact workflow dispatch.

### PR handoff

Published [PR #23](https://github.com/ragemous3/personal-webpage/pull/23). Ticket CLOSED after the branch push and PR creation, as required by the implementation flow. Both reviews and the final 147-test suite apply to ac22203a9ddd0d759712d1b5a8eed6195d41a3ae; subsequent changes are ticket metadata only. Next: closure push, hosted Online evidence and final CI/readback checks. Routine output remains ignored. Merge and deployment are not authorized.

Hosted Online verification [run 42175505101](https://github.com/ragemous3/personal-webpage/actions/runs/42175505101) PASS at metadata head bccfa64819336524e6947ce3d5a596b2242cb615. [Download the report and screenshot](https://github.com/ragemous3/personal-webpage/actions/runs/42175505101/artifacts/13483266468), retained for 90 days. The run uses the same implementation source digest a61ee5df646706ccf73a5ca5b15db4071920c44ad5b82ed4cc87a4514ed2b2c3. All four CI checks (test, lint, typecheck, build) PASS at that head. Local settings/cache reports remain workspace-only evidence tied to their recorded source, with byte-identical production workers as explained above; the hosted Online artifact does not imply those local screenshots were uploaded. PR-body readback matches the prepared description. This final update records artifact links only; reviews and final-suite results remain valid. Final CI is checked again after its push.
