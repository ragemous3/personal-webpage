import { type SpeechAudio } from '@/layers/shared/models/speech.model';
export interface SpeechSynthesisContract {
  initialize(signal: AbortSignal): Promise<void>;
  synthesize(text: string, signal: AbortSignal): Promise<SpeechAudio[]>;
  release(): void;
  dispose(): void;
}
