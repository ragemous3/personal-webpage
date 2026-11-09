declare module '@met4citizen/talkinghead' {
  import { type SpeechAudio } from '@/layers/shared/models/speech.model';
  export class TalkingHead {
    constructor(host: HTMLElement, options: Record<string, unknown>);
    audioCtx: AudioContext;
    showAvatar(options: { url: string; body: string; lipsyncLang: string }): Promise<void>;
    speakAudio(audio: SpeechAudio & { markers: Array<() => void>; mtimes: number[] }): void;
    animQueue: Array<{ template: { name: string } }>;
    animFactory(template: {
      name: string;
      dt: number[];
      vs: Record<string, Array<number | null>>;
    }): { template: { name: string } };
    start(): void;
    stop(): void;
    stopSpeaking(): void;
    dispose(): void;
  }
}

declare module '@met4citizen/talkinghead/modules/lipsync-en.mjs' {
  export class LipsyncEn {
    preProcessText(text: string): string;
    wordsToVisemes(text: string): { visemes: string[]; times: number[]; durations: number[] };
  }
}
