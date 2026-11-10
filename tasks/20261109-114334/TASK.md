# Generate speech on the server and stream audio to the browser

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

## Background

The talking-head prototype uses browser speech in Local and Online modes. The browser chooses available system voices, so voice availability, quality and word-boundary events vary by device. Browser-side Kokoro increased memory pressure alongside real Qwen/retrieval models, and even the q8 experiment failed a cached restart journey. See [the prototype and measurements](../20261108-123438/TASK.md).

Generate audio on the existing Node.js/Express/TypeScript server and stream it to the browser so speech playback does not require a browser-side neural voice model. This is future work; current speech remains browser-native. Reuse the generation observer and composition-owned speech dependencies. RagService remains the only initiator of answer generation.

## Prerequisites

- Review the resulting prototype's TalkingHeadService, speech contracts, BrowserSpeechAdapter, TalkingHeadAdapter, BrowserSpeechLipSync and existing API client/server infrastructure.
- Confirm the TTS provider/model, credentials or hosting prerequisites, supported browser playback format, and which modes may use server audio. These are not yet established.
- Agree the stream framing, cancellation/error semantics, playback buffering and mouth-timing strategy before implementation. Confirm whether provider timings are available or text estimates are needed.
- Select an implementation mode under docs/implementation-flow.md when implementation starts. This planning request does not authorize provider charges or deployment.

## Acceptance criteria

- [ ] A generated answer can be sent to a server text-to-audio endpoint and converted into an audio response. The text matches that answer; speech does not initiate another LLM generation or retrieval operation.
- [ ] Audio streams from the server and begins playing before the complete response has been generated/downloaded. Verify incremental playback, not only a streamed download followed by full-buffer playback.
- [ ] The browser does not download or run a neural TTS model for this path. Provider credentials remain on the server.
- [ ] Reuse the existing Express/TypeScript API and API-base client conventions. Composition selects the speech implementation; provider-specific details stay behind the appropriate existing or scoped contracts, without putting business wiring in views.
- [ ] Stream chunks play in order with bounded buffering. Partial transport chunks, codec/browser compatibility and slow consumers are handled according to the agreed protocol.
- [ ] Stop, Cancel, Reset, a replacement answer, mode changes and disposal abort the browser request/playback and propagate cancellation to active server/provider work where supported. Disconnects release server resources; obsolete chunks cannot restart speech.
- [ ] The head animates while streamed audio plays and returns to a closed mouth on completion/cancellation/error. Document whether timing comes from provider timestamps or approximate text alignment; verify the chosen approach.
- [ ] Server/provider failures and interrupted streams leave text chat and history usable and show a useful status. Retry does not regenerate the answer. Any browser-speech fallback is explicit in the agreed design and cannot produce duplicate playback.
- [ ] Server audio is identified as requiring server connectivity; Local answer generation can remain local when server speech is selected, without implying fully offline speech.
- [ ] Measure first audio byte, first audible playback, buffering behavior and cancellation response using the agreed provider/test seam. Record controlled versus live-provider coverage separately.

## Dependencies

- [Talking-head prototype](../20261108-123438/TASK.md): generation observation, speech lifecycle and composition boundaries. Inspect its final merged shape before implementation.
- Existing Node.js/Express/TypeScript API and ApiBase client infrastructure.
- Provider/model, codec and playback decisions listed above. No provider is selected by this ticket.

## Definition of Done

- [ ] Verify the acceptance criteria with focused server/client stream and lifecycle tests, including partial chunks, early cancellation, disconnects, errors after playback starts and stale-output suppression.
- [ ] Verify incremental playback and head animation in the real browser. A collected blob or server response alone is insufficient. Record provider/audio prerequisites and any unverified live-provider checks.
- [ ] Follow the repository implementation flow, required reviews and final checks. Update the affected service/application diagrams under docs/architecture with exact implemented names and the architecture-mermaid style.
- [ ] Update speech/API documentation with the selected provider, protocol, connectivity requirements, lifecycle, timing limits and test commands. Keep routine audio/video/traces as ignored PR/CI artifacts with source provenance and retention.
