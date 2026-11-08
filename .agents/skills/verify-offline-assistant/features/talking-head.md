# Talking head and voice

Entry: production ChatbotModeProviderAbstract renders TalkingHeadComponent alongside ChatContainer.

Journey: enable English speech, ask a question, observe the visible Online answer with real Kokoro audio and timed mouth movement, Stop/Reset, restart with outbound DNS blocked and cached models, then switch Local and ask another question using browser speech without a speech Worker. Local mouth animation is not provided. A missing system voice is a BLOCKED native-speech prerequisite, not a passing audio check.

Command: `npm run verify:browser -- --mode speech`. Use `RUNTIME_MODEL_DIR` for real Local generation/retrieval; the default generation drivers and Online HTTP endpoint are controlled fixtures. See [prototype details](../../../../docs/talking-head.md).

Evidence: talking-head.webm, talking-head.png, nonempty audio-buffer observations, cold/warm timings, model/voice cache URLs, worker inventory and cleanup fields. Routine run output stays in ignored artifacts. Rendering a canvas or synthesizing audio without observing mouth movement is incomplete lip-sync evidence.
