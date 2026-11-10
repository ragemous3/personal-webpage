import { type SpeechOutput } from '@/layers/shared/models/speech.model';
export interface SpeechSynthesisContract {
  initialize(signal: AbortSignal): Promise<void>;
  synthesize(text: string, signal: AbortSignal): Promise<SpeechOutput[]>;
  release(): void;
  dispose(): void;
}
