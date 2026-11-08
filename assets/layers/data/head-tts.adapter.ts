import { HeadTTS } from '@met4citizen/headtts';

import { type SpeechSynthesisContract } from '@/layers/shared/contracts/speech-synthesis.contract';
import { type SpeechAudio } from '@/layers/shared/models/speech.model';

export class HeadTTSAdapter implements SpeechSynthesisContract {
  #tts: HeadTTS | undefined;
  #audio: AudioContext | undefined;
  #disposed = false;
  constructor(private readonly baseURL: string) {}
  async initialize(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.#disposed) throw new Error('Speech was disposed.');
    if (this.#tts?.isConnected) return;
    this.#audio ??= new AudioContext();
    const base = new URL(this.baseURL, globalThis.location.href);
    const tts = new HeadTTS({
      audioCtx: this.#audio,
      endpoints: ['wasm'],
      workerModule: new URL('speech/head-tts.worker.js', base).href,
      transformersModule: new URL('vendor/speech-transformers/transformers.min.js', base).href,
      dictionaryURL: new URL('speech/headtts/dictionaries/', base).href,
      voices: ['af_bella'],
      defaultVoice: 'af_bella',
    });
    this.#tts = tts;
    const abort = (): void => this.#terminate(tts);
    signal.addEventListener('abort', abort, { once: true });
    try {
      await tts.connect();
      signal.throwIfAborted();
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
  async synthesize(text: string, signal: AbortSignal): Promise<SpeechAudio[]> {
    await this.initialize(signal);
    const tts = this.#tts;
    if (!tts) throw new Error('Speech is unavailable.');
    const abort = (): void => this.#terminate(tts);
    signal.addEventListener('abort', abort, { once: true });
    try {
      const messages = await tts.synthesize({ input: text });
      signal.throwIfAborted();
      if (messages.some((message) => message.type === 'error'))
        throw new Error('Speech synthesis failed.');
      return messages.filter((message) => message.type === 'audio').map((message) => message.data);
    } finally {
      signal.removeEventListener('abort', abort);
    }
  }
  release(): void {
    if (this.#tts) this.#terminate(this.#tts);
  }
  dispose(): void {
    this.#disposed = true;
    this.release();
    void this.#audio?.close();
  }
  #terminate(tts: HeadTTS): void {
    tts.clear();
    tts.ww?.terminate();
    tts.ww = null;
    tts.isConnected = false;
    if (this.#tts === tts) this.#tts = undefined;
  }
}
