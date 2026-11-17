import { type SpeechOutput } from '@/layers/shared/models/speech.model';
export interface TalkingHeadPresentationContract {
  mount(host: HTMLElement): Promise<void>;
  activate(): Promise<void>;
  play(audio: SpeechOutput, signal: AbortSignal): Promise<void>;
  stop(): void;
  dispose(): void;
}
