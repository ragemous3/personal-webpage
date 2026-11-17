export interface ChatGenerationState {
  ready: boolean;
  error?: string;
  runtimeFailure?: boolean;
}

export type ChatGenerationEvent =
  | { type: 'start' | 'cancelled'; requestId: string }
  | { type: 'delta' | 'complete'; requestId: string; text: string }
  | { type: 'error'; requestId: string; error: string };
