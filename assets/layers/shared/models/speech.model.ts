export interface SpeechAudio {
  audio: AudioBuffer;
  words: string[];
  wtimes: number[];
  wdurations: number[];
  visemes: string[];
  vtimes: number[];
  vdurations: number[];
}
export interface TalkingHeadState {
  status: 'unavailable' | 'disabled' | 'loading' | 'ready' | 'speaking' | 'error';
  error?: string;
}

export interface TalkingHeadOptions {
  available?: boolean;
  releaseVoiceDuringGeneration?: boolean;
}
