declare module '@met4citizen/headtts' {
  import { type SpeechAudio } from '@/layers/shared/models/speech.model';
  export class HeadTTS {
    constructor(settings: Record<string, unknown>);
    ww: Worker | null;
    isConnected: boolean;
    clear(): void;
    connect(): Promise<void>;
    synthesize(input: {
      input: string;
    }): Promise<Array<{ type: string; data: SpeechAudio; error?: string }>>;
  }
}
