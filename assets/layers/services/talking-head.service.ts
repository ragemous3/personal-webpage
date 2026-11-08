import { type ChatGenerationContract } from '@/layers/shared/contracts/chat-generation.contract';
import { type ChatLifecycleEvent } from '@/layers/shared/contracts/chatbot-service.contract';
import { type SpeechSynthesisContract } from '@/layers/shared/contracts/speech-synthesis.contract';
import { type TalkingHeadPresentationContract } from '@/layers/shared/contracts/talking-head-presentation.contract';
import { type TalkingHeadServiceContract } from '@/layers/shared/contracts/talking-head-service.contract';
import { type ChatGenerationEvent } from '@/layers/shared/models/chat-generation.model';
import {
  type SpeechAudio,
  type TalkingHeadOptions,
  type TalkingHeadState,
} from '@/layers/shared/models/speech.model';
import {
  createStatefulSubscribable,
  type ReadonlyConnections,
} from '@/layers/shared/utils/subscribable';

export class TalkingHeadService implements TalkingHeadServiceContract {
  readonly stateSubscription = createStatefulSubscribable<TalkingHeadState>({ status: 'disabled' });
  readonly #connections: Array<() => void>;
  #enabled = false;
  #available: boolean;
  readonly #releaseVoiceDuringGeneration: boolean;
  #disposed = false;
  #request: string | undefined;
  #work: AbortController | undefined;
  constructor(
    generation: Pick<ChatGenerationContract, 'generationSubscription'>,
    lifecycle: ReadonlyConnections<ChatLifecycleEvent>,
    private readonly synthesis: SpeechSynthesisContract,
    private readonly presentation: TalkingHeadPresentationContract,
    options: TalkingHeadOptions = {},
  ) {
    this.#available = options.available ?? true;
    this.#releaseVoiceDuringGeneration = options.releaseVoiceDuringGeneration ?? false;
    if (!this.#available) this.stateSubscription.emit({ status: 'unavailable' });
    this.#connections = [
      generation.generationSubscription.connect(this.#receive),
      lifecycle.connect(this.#lifecycle),
    ];
  }
  async mount(host: HTMLElement): Promise<void> {
    try {
      await this.presentation.mount(host);
    } catch (error) {
      if (!this.#disposed) this.#fail(error);
    }
  }
  async enable(): Promise<void> {
    if (!this.#canEnable()) return;
    const work = new AbortController();
    this.#work = work;
    this.stateSubscription.emit({ status: 'loading' });
    try {
      await this.presentation.activate();
      await this.synthesis.initialize(work.signal);
      if (!this.#current(work)) return;
      this.#enabled = true;
      this.stateSubscription.emit({ status: 'ready' });
    } catch (error) {
      if (this.#current(work)) this.#fail(error);
    } finally {
      if (this.#work === work) this.#work = undefined;
    }
  }
  stop(): void {
    this.#request = undefined;
    this.#work?.abort();
    this.#work = undefined;
    this.presentation.stop();
    if (!this.#disposed) this.stateSubscription.emit({ status: this.#status() });
  }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    for (const disconnect of this.#connections) disconnect();
    this.synthesis.dispose();
    this.presentation.dispose();
    this.stateSubscription.disconnect();
  }
  readonly #lifecycle = (event: ChatLifecycleEvent): void => {
    if (event !== 'invalidate') {
      this.#available = event === 'available';
      if (!this.#available) this.#enabled = false;
    }
    this.stop();
    if (!this.#available) this.synthesis.release();
  };
  #status(): TalkingHeadState['status'] {
    if (!this.#available) return 'unavailable';
    return this.#enabled ? 'ready' : 'disabled';
  }
  #current(work: AbortController): boolean {
    return !work.signal.aborted && !this.#disposed;
  }
  #canEnable(): boolean {
    return this.#available && !this.#disposed && !this.#enabled && !this.#work;
  }
  readonly #receive = (event: ChatGenerationEvent): void => {
    if (this.#disposed) return;
    if (event.type === 'start') {
      this.#begin(event.requestId);
      return;
    }
    if (event.requestId !== this.#request) return;
    if (event.type !== 'complete') {
      if (event.type !== 'delta') this.stop();
      return;
    }
    this.#request = undefined;
    if (this.#enabled && event.text.trim()) void this.#speak(event.text);
  };
  #begin(requestId: string): void {
    this.stop();
    if (this.#releaseVoiceDuringGeneration) this.synthesis.release();
    this.#request = requestId;
  }
  async #speak(text: string): Promise<void> {
    const work = new AbortController();
    this.#work = work;
    this.stateSubscription.emit({ status: 'loading' });
    try {
      const audio = await this.synthesis.synthesize(text, work.signal);
      await this.#play(audio, work);
      if (this.#current(work)) this.presentation.stop();
      if (this.#current(work)) this.stateSubscription.emit({ status: 'ready' });
    } catch (error) {
      if (this.#current(work)) this.#fail(error);
    } finally {
      if (this.#work === work) this.#work = undefined;
    }
  }
  async #play(audio: SpeechAudio[], work: AbortController): Promise<void> {
    for (const item of audio) {
      if (!this.#current(work)) return;
      this.stateSubscription.emit({ status: 'speaking' });
      await this.presentation.play(item, work.signal);
    }
  }
  #fail(error: unknown): void {
    this.#enabled = false;
    this.presentation.stop();
    this.stateSubscription.emit({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
