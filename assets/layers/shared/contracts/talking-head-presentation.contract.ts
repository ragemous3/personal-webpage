import { type SpeechAudio } from '@/layers/shared/models/speech.model';
export interface TalkingHeadPresentationContract {
  mount(host: HTMLElement): Promise<void>;
  activate(): Promise<void>;
  play(audio: SpeechAudio, signal: AbortSignal): Promise<void>;
  stop(): void;
  dispose(): void;
}
