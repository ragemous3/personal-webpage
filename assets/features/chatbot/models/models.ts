import { Chat, TextGenerationConfig } from '@huggingface/transformers';

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

interface WorkerData {
  readonly task: 'init' | 'query';
  readonly query: string;
}

interface LLMWorkerData extends WorkerData {
  readonly chatMessages: Chat;
  readonly sysMessage: SysMessage;
}

interface VectorDBWorkerData extends WorkerData {
  readonly task: 'init' | 'query';
  readonly query: string;
}

type RAGStatus = {
  status: RagStates;
};

export type {
  ChatMessage,
  Chunk,
  GenerationConfig,
  HNSWDBEntry,
  LLMWorkerData,
  RAGStatus,
  VectorDBWorkerData,
};
