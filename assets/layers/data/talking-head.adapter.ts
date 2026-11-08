import { TalkingHead } from '@met4citizen/talkinghead';

import { type TalkingHeadPresentationContract } from '@/layers/shared/contracts/talking-head-presentation.contract';
import { type SpeechAudio } from '@/layers/shared/models/speech.model';

export class TalkingHeadAdapter implements TalkingHeadPresentationContract {
  #head: TalkingHead | undefined;
  #disposed = false;
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
  play(audio: SpeechAudio, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const head = this.#head;
    if (!head || this.#disposed) return Promise.reject(new Error('The head is unavailable.'));
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
  #isDisposed(): boolean {
    return this.#disposed;
  }
  stop(): void {
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
