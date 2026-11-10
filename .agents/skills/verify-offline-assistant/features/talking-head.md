# Talking head and voice

Entry: production ChatbotModeProviderAbstract renders TalkingHeadComponent alongside ChatContainer.

Journey: enable browser speech, ask Online and Local questions, compare native utterance text to the answer, verify text-driven mouth motion and Stop/Reset, and restart with external DNS blocked. Both modes have zero speech Workers. System voice availability and audible speech are separate checks; missing voices yield BLOCKED while text/error and mode/restart checks continue. Label controlled native-event animation probes and never infer audible synchronization from them.

Command: `npm run verify:browser -- --mode speech`. Use `RUNTIME_MODEL_DIR` for real Local generation/retrieval; the default generation drivers and Online HTTP endpoint are controlled fixtures. See [prototype details](../../../../docs/talking-head.md).

Evidence: talking-head.webm, talking-head.png (Online), local-answer.png and returning-local-answer.png, native utterance events/errors, timings, Worker inventory and cleanup fields. Routine run output stays in ignored artifacts. Verify the avatar remains visible after layout changes and Stop; a canvas element alone does not establish visible rendering. Controlled speech events can show mouth motion but cannot prove audible synchronization.
