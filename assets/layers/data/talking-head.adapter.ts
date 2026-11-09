import { TalkingHead } from '@met4citizen/talkinghead';

import { BrowserSpeechLipSync } from '@/layers/data/utils/browser-speech-lip-sync.utility';
import { type TalkingHeadPresentationContract } from '@/layers/shared/contracts/talking-head-presentation.contract';
import { type SpeechOutput } from '@/layers/shared/models/speech.model';

export class TalkingHeadAdapter implements TalkingHeadPresentationContract {
  #head: TalkingHead | undefined;
  #disposed = false;
  #cancelBrowser: (() => void) | undefined;
  #mounted: Promise<void> | undefined;
  constructor(private readonly baseURL: string) {}
  async mount(host: HTMLElement): Promise<void> {
    if (this.#disposed) return;
    const head = new TalkingHead(host, {
      cameraView: 'head',
      lipsyncModules: [],
      ttsEndpoint: null,
    });
    this.#head = head;
    this.#mounted = head.showAvatar({
      url: new URL('avatars/mpfb.glb', new URL(this.baseURL, globalThis.location.href)).href,
      body: 'F',
      lipsyncLang: 'en',
    });
    await this.#mounted;
    if (!this.#isDisposed()) this.stop();
  }
  async activate(): Promise<void> {
    if (!this.#head || this.#disposed) throw new Error('The head is unavailable.');
    await Promise.all([this.#head.audioCtx.resume(), this.#mounted]);
  }
  play(audio: SpeechOutput, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.#disposed) return Promise.reject(new Error('The head is unavailable.'));
    if ('text' in audio) return this.#speak(audio.text, signal);
    const head = this.#head;
    if (!head) return Promise.reject(new Error('The head is unavailable.'));
    head.start();
    return new Promise((resolve, reject) => {
      const abort = (): void => {
        head.stopSpeaking();
        cleanup();
        reject(new DOMException('Speech cancelled.', 'AbortError'));
      };
      const cleanup = (): void => signal.removeEventListener('abort', abort);
      signal.addEventListener('abort', abort, { once: true });
      head.speakAudio({
        ...audio,
        markers: [
          () => {
            cleanup();
            resolve();
          },
        ],
        mtimes: [audio.audio.duration * 1000],
      });
    });
  }
  #speak(text: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      const lipsync = this.#head
        ? new BrowserSpeechLipSync(this.#head, text, utterance.rate)
        : undefined;
      const start = (): void => lipsync?.start();
      const boundary = (event: SpeechSynthesisEvent): void => {
        if (event.name === 'word') lipsync?.boundary(event.charIndex);
      };
      const cleanup = (): void => {
        lipsync?.stop();
        utterance.removeEventListener('start', start);
        utterance.removeEventListener('boundary', boundary);
        signal.removeEventListener('abort', abort);
        utterance.removeEventListener('end', end);
        utterance.removeEventListener('error', error);
        if (this.#cancelBrowser === abort) this.#cancelBrowser = undefined;
      };
      const abort = (): void => {
        cleanup();
        globalThis.speechSynthesis.cancel();
        reject(new DOMException('Speech cancelled.', 'AbortError'));
      };
      const end = (): void => {
        cleanup();
        resolve();
      };
      const error = (event: SpeechSynthesisErrorEvent): void => {
        cleanup();
        reject(new Error(`Browser speech failed: ${event.error}`));
      };
      this.#cancelBrowser = abort;
      utterance.addEventListener('start', start, { once: true });
      utterance.addEventListener('boundary', boundary);
      utterance.addEventListener('end', end, { once: true });
      utterance.addEventListener('error', error, { once: true });
      signal.addEventListener('abort', abort, { once: true });
      try {
        globalThis.speechSynthesis.speak(utterance);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  #isDisposed(): boolean {
    return this.#disposed;
  }
  stop(): void {
    this.#cancelBrowser?.();
    this.#head?.stopSpeaking();
    this.#head?.stop();
  }
  dispose(): void {
    this.#disposed = true;
    this.stop();
    const head = this.#head;
    this.#head = undefined;
    if (!head) return;
    const mounted = this.#mounted ?? Promise.resolve();
    const release = (): void => this.#release(head);
    void mounted.then(release, release);
  }
  #release(head: TalkingHead): void {
    head.dispose();
    if (head.audioCtx.state !== 'closed') void head.audioCtx.close();
  }
}
