declare module '@met4citizen/talkinghead' {
  export class TalkingHead {
    constructor(host: HTMLElement, options: Record<string, unknown>);
    audioCtx: AudioContext;
    renderer: { render(scene: unknown, camera: unknown): void };
    onResize(): void;
    scene: unknown;
    camera: unknown;
    render(): void;
    showAvatar(options: { url: string; body: string; lipsyncLang: string }): Promise<void>;
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
