export interface TalkingHeadState {
  status: 'unavailable' | 'disabled' | 'loading' | 'ready' | 'speaking' | 'error';
  error?: string;
}

export interface TalkingHeadOptions {
  available?: boolean;
}

export interface SpeechOutput {
  text: string;
}
