# Online generation

Select Online to keep résumé retrieval in the browser and generate answers through the application's Express API. The retrieval model and index remain necessary. An Online-only visit does not initialize the local language model.

ChatbotProvider observes configuration and directly renders AssistantConfiguration beside one mode-specific component. It owns configuration, the retrieval DB and the current tab's conversation identity. ChatbotOfflineProvider and ChatbotOnlineProvider consume those shared dependencies through Lit context and build their own RagService and generation dependency. ChatbotModeProviderAbstract shares their context and disposal behavior; both reuse ChatContainer and RagService.

Local generation reuses Chat and LocalLLMData in the language-model SharedWorker. OnlineChatClient extends ApiBase and streams the Express API directly from the tab. Online requests do not enter the shared generation queue or wait for the Local model. RuntimeCoordinator retains whole-response leases and configuration coordination. It connects only the model roles the selected mode needs. The server injects GenerationProviderAbstract, initially OpenAIProvider.

Switching Online can supersede pending Local initialization. An already-started Local pipeline may finish in its worker, but it does not block the Online tree. Accepted responses and history writes still drain before a tree changes. Identical retrieval initialization continues across that change.

The browser resolves model discovery and generation against chatbot.config.online.apiBaseURL in config/_default/params.toml. The default directory is /api/, with relative models and generate routes. Model discovery supplies the allowed Online model and supported controls. Local preferences remain separate. The initial model is `gpt-6-luna` with low reasoning effort, using the OpenAI Responses API. Online output-token limits include reasoning tokens; a small limit can produce an incomplete response. Local-only execution, precision and sampling controls are hidden in Online mode. The server does not forward those settings to OpenAI.

Send streams an answer. Cancel requests upstream cancellation and keeps partial text. Reset cancels active work and clears this tab's history. Retry is explicit. Mode changes preserve history and wait for accepted responses to complete, fail or be cancelled. Errors preserve partial output and do not automatically replay a request or switch providers. SDK retries are disabled. Cancelling a request does not guarantee that the provider stops billing immediately.

RagService saves each question before retrieval/generation and commits ordered response updates before displaying them. ChatHistoryRepository persists conversations in IndexedDB. A mode switch keeps the same tab ID and history; ConversationIdentity extends WebStorageBase and reuses the sessionStorage ID only for an actual reload. Fresh/non-reload entries, including copied opener storage and the tested browser-session restore path, replace that ID. Unfinished saved answers restore as interrupted and are never replayed. Browser session restoration differs across browsers; the navigation-type distinction was checked in Chromium. Saved-chat discovery and context-budget policies have separate follow-up tickets.

A storage failure blocks Send and cancels generation. Partial displayed text remains visible. Retry saving commits the pending history before chat continues; it does not repeat generation. Reset clears only this conversation. Browser storage remains subject to browser eviction and user clearing. The application server does not store conversations. API requests transmit relevant history and retrieved context to OpenAI, accept bounded user/assistant messages and supply server-owned instructions with `store: false`. Client system messages and unsupported models are rejected. No quotas, spending accounting or visitor tracking are implemented in this scope.

If storage and runtime faults overlap, Retry saving stays available first. After saving succeeds, reconnect remains available for a runtime that still needs recovery. Neither action silently repeats generation.

## Run locally

Install dependencies with `npm ci`, build the site with `npm run build`, set `OPENAI_API_KEY` in the server environment, and run `npm start`. Express serves the built `public/` site and `/api` from port 3000, or the configured `PORT`. Keep the key out of Hugo parameters and browser code. `OPENAI_MODEL` can select another compatible Responses model configured by the operator; low reasoning effort and the published control bounds must remain compatible with that model. The label defaults to the configured model ID.

Hosting remains provider-neutral. A deployment can run the Express process behind the website's `/api` route while static hosting serves the built site. Preserve streamed responses without proxy buffering and permit the generation deadline. The API has a two-minute deadline and aborts upstream work when the browser disconnects. This ticket does not deploy the application.

## Verification

`npm run verify:browser -- --mode online` builds the production application and uses the browser client, real Express API and OpenAI SDK. A controlled HTTP endpoint supplies OpenAI-format streaming events. Retrieval and Local inference use labelled model fixtures in native SharedWorkers. The run checks switching, controls, reload restoration and fresh-tab isolation. It does not prove real OpenAI access, answer quality or real model performance. No credentials are needed for this journey.

Focused tests cover the API, online generation stream, settings and existing Local lifecycle. Routine reports and screenshots remain under ignored `artifacts/verification/`; the manual Browser verification workflow publishes Online evidence with 90-day retention. The source digest includes server files. Live credentialed OpenAI verification was waived by the user because no credentials are available; project/model access remains unverified.
