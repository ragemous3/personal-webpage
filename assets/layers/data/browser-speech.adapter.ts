import { type SpeechSynthesisContract } from '@/layers/shared/contracts/speech-synthesis.contract';
import { type SpeechOutput } from '@/layers/shared/models/speech.model';

export class BrowserSpeechAdapter implements SpeechSynthesisContract {
  initialize(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (
      typeof globalThis.speechSynthesis !== 'object' ||
      typeof globalThis.SpeechSynthesisUtterance !== 'function'
    )
      return Promise.reject(new Error('Browser speech is unavailable.'));
    return Promise.resolve();
  }
  async synthesize(text: string, signal: AbortSignal): Promise<SpeechOutput[]> {
    await this.initialize(signal);
    return [{ text }];
  }
  release(): void {
    return;
  }
  dispose(): void {
    return;
  }
}
