# Online generation

Select Online to keep résumé retrieval in the browser and generate answers through the application's Express API. The retrieval model and index remain necessary. An Online-only visit does not initialize the local language model.

The existing RagService owns retrieval, conversation history and response controls. RuntimeCoordinator retains response leases, routing and configuration changes. The same generation SharedWorker uses either LocalLLMData or OnlineGeneration, which share GenerationAbstract. No additional application worker is created. OnlineGeneration streams the application API; the server injects its GenerationProviderAbstract, initially OpenAIProvider. Abstract classes share core behavior and DI selects the implementation.

The browser fetches `/api/models` for the allowed Online model and supported controls. Local preferences remain separate. The initial model is `gpt-6-luna` with low reasoning effort, using the OpenAI Responses API. Online output-token limits include reasoning tokens; a small limit can produce an incomplete response. Local-only execution, precision and sampling controls are hidden in Online mode. The server does not forward those settings to OpenAI.

Send streams an answer. Cancel requests upstream cancellation and keeps partial text. Reset cancels active work and clears this tab's history. Retry is explicit. Mode changes preserve history and wait for accepted responses to complete, fail or be cancelled. Errors preserve partial output and do not automatically replay a request or switch providers. SDK retries are disabled. Cancelling a request does not guarantee that the provider stops billing immediately.

The API accepts bounded user/assistant messages, supplies trusted résumé-answering instructions and sets `store: false` for OpenAI Responses. It rejects client system messages and unsupported models. Conversation history remains in the tab; the application server does not persist it. Requests still transmit the relevant history and retrieved context to OpenAI. No quotas, spending accounting or visitor tracking are implemented in this scope.

## Run locally

Install dependencies with `npm ci`, build the site with `npm run build`, set `OPENAI_API_KEY` in the server environment, and run `npm start`. Express serves the built `public/` site and `/api` from port 3000, or the configured `PORT`. Keep the key out of Hugo parameters and browser code. `OPENAI_MODEL` can select another compatible Responses model configured by the operator; low reasoning effort and the published control bounds must remain compatible with that model. The label defaults to the configured model ID.

Hosting remains provider-neutral. A deployment can run the Express process behind the website's `/api` route while static hosting serves the built site. Preserve streamed responses without proxy buffering and permit the generation deadline. The API has a two-minute deadline and aborts upstream work when the browser disconnects. This ticket does not deploy the application.

## Verification

`npm run verify:browser -- --mode online` builds the production application and uses the real Express API, OpenAI SDK, generation handler and native three-SharedWorker coordination. A controlled HTTP endpoint supplies OpenAI-format streaming events. Retrieval and Local inference use labelled model fixtures. The run verifies controls and transport, not real OpenAI access, answer quality or real model performance. No credentials are needed for this journey.

Focused tests cover the API, online generation stream, settings and existing Local lifecycle. Routine reports and screenshots remain under ignored `artifacts/verification/`; the manual Browser verification workflow publishes Online evidence with 90-day retention. The source digest includes server files. Live credentialed OpenAI verification was waived by the user because no credentials are available; project/model access remains unverified.
