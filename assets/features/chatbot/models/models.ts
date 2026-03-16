import { Chat, TextGenerationConfig } from '@huggingface/transformers';
import { Nullable } from '../../../shared/models';

type GenerationConfig = TextGenerationConfig;
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type SysMessage = { role: 'system'; content: string };

interface Chunk {
  readonly text: string;
  readonly index: number;
}

interface HNSWDBEntry {
  timestamp: string | Date;
  mode: number;
  contents: Uint8Array;
}

type RAGStatus = {
  status: RagStates;
};
export type { ChatMessage, SysMessage, Chunk, GenerationConfig, HNSWDBEntry, RAGStatus };
