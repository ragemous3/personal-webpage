declare module '@met4citizen/talkinghead' {
  import { type SpeechAudio } from '@/layers/shared/models/speech.model';
  export class TalkingHead {
    constructor(host: HTMLElement, options: Record<string, unknown>);
    audioCtx: AudioContext;
    showAvatar(options: { url: string; body: string; lipsyncLang: string }): Promise<void>;
    speakAudio(audio: SpeechAudio & { markers: Array<() => void>; mtimes: number[] }): void;
    start(): void;
    stop(): void;
    stopSpeaking(): void;
    dispose(): void;
  }
}
