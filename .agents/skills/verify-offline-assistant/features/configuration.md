# Change assistant settings

Use the home page with matching résumé index data and a fresh disposable profile. The settings shadow root is `chatbot-offline-provider >>> assistant-configuration`; the chat is `chatbot-offline-provider >>> chat-container`.

1. Observe the default Local / Qwen / Auto settings. Confirm worker initialization receives `auto` for generation and retrieval. Do not infer the actual provider from this requested value.
2. Choose CPU in `select[name=execution]`. Wait for the chat input to become available. Expand Advanced and set a small positive token budget in `input[name=maxNewTokens]` for a practical CPU run.
3. Submit a résumé question. While responding, change the token budget. Confirm pending feedback, no cancellation, a completed answer, and retained history. Check the next question uses the new budget without reloading weights.
4. Choose Online in `select[name=mode]`. Confirm the unavailable message, disabled Send, retained history, and no remote inference. Return to Local and confirm history survives model replacement.
5. On a host without WebGPU, explicitly select WebGPU. Confirm the failed combination and diagnostic are visible. Choose Switch back and wait for CPU readiness. If no working configuration exists, confirm Restore defaults is offered instead.
6. Reload the page and confirm saved choices are resolved before model startup. Conversation persistence is not part of this feature.
7. Open another tab in the same browser profile. Confirm it initializes no model or retrieval worker: requests and replies must pass through the existing SharedWorker to the live owner tab. Change settings while both tabs respond. Confirm both responses finish, the conversations stay separate, and the latest choices apply once the shared bot is idle. A generation-only edit must not reload weights. Closing a follower must not terminate the owner; closing the owner allows a remaining tab to acquire exclusive ownership and initialize one replacement runtime.

Retain settings and chat screenshots, worker initialization observations, action/results, errors, source revision, and cleanup evidence. A controlled browser-worker test proves UI/storage behavior, not real model execution or hardware fallback. Record unavailable WebGPU as a limitation.
