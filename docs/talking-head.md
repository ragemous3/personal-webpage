# Talking head prototype

The assistant shows a centered MPFB avatar in a 320-by-320 mount. Enable speech loads the English Kokoro voice after a user action. Stop speech stops the current utterance; a new answer can speak while speech remains enabled. Reset, a replacement question, failures and mode disposal invalidate pending speech. Reload and mode changes require enabling speech again.

Composition supplies the same Local `Chat` or `OnlineChatClient` instance to RagService and TalkingHeadService. RagService alone starts generation. The head observes request-scoped generation events through `ChatGenerationContract`; speech starts from completed answers independently of history saving. `ChatbotServiceContract.lifecycleSubscription` carries invalidation that can happen before generation or after it finishes. Restored history is never the speech source.

TalkingHeadService coordinates HeadTTSAdapter and TalkingHeadAdapter through shared contracts. HeadTTSAdapter uses HeadTTS 1.3.0 and WASM Kokoro inference in one dedicated Worker per enabled tab. This worker is separate from the application's three SharedWorkers. TalkingHeadAdapter uses TalkingHead 1.8.2 and Three.js for avatar rendering, audio and Oculus visemes. Stop, Reset and new questions stop active synthesis; configuration unavailability releases the idle voice worker; a later answer reconnects from cached assets. Idle rendering pauses while the model is loading or the head is silent; playback resumes it. Local generation also releases the voice model before inference to keep peak memory lower; Online mode can keep the voice warm. Mode disposal also closes the audio contexts and releases the renderer.

The specific avatar is CC0; [its provenance](../static/avatars/README.md) records the source revision and hash. [Third-party notices](../static/speech/third-party-notices.txt) cover the SDKs and runtime. Model weights download at runtime. English is the supported prototype language. Microphone input, additional voice choices and streamed sentence delivery are outside this prototype.

Transformers.js owns model/tokenizer/WASM caching. The worker's fetch wrapper caches voices and dictionaries separately, tolerates unavailable storage, and leaves partial model responses to the model framework. A model cache does not establish that the whole site works offline or that the browser will retain data indefinitely.

## Verification

Run `npm run verify:browser -- --mode speech` with the repository's Hugo and Chromium prerequisites. This uses real MPFB rendering and real Kokoro speech, with controlled résumé retrieval and Local/Online generation. It exercises a question through the production UI, Stop/Reset, a browser restart with external DNS blocked, and a Local mode switch. Audio-buffer observations, a screenshot, video, timing measurements and cache URLs remain in the ignored evidence directory after cleanup.

Set `RUNTIME_MODEL_DIR` to the model mirror described in [runtime-coordinator.md](runtime-coordinator.md) to also use real Local generation/retrieval. Online generation still uses the controlled OpenAI HTTP endpoint. No paid TTS credentials are required. Live OpenAI and hardware WebGPU inference are separate claims.

With idle rendering paused, the software-rendered CPU run measured about 28 seconds for cold voice initialization, 6.5 seconds from an Online question to first audio, and 10–11 seconds for controlled Local/cached speech. These include the prototype's model/resource policy and are not hardware-wide guarantees.

Real Qwen plus Kokoro currently exceeds the 8 GB execution environment's memory limit. The same real Qwen question passes with speech disabled. The full controlled-generation speech journey passes, including nonzero audio samples, visible mouth movement, Stop/Reset, mode changes and cached restart. Real-model coexistence remains an open verification blocker; this prototype does not claim that case works on 8 GB devices.
