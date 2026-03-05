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

interface WorkerError {
  name: string;
  message: string;
  stack: Nullable<string>;
}

interface WorkerData<T> {
  readonly task: 'init' | 'query';
  readonly query: string;
  readonly error?: WorkerError;
  readonly payload?: T;
}

interface LLMWorkerData extends WorkerData<{
  readonly chatMessages: Chat;
  readonly sysMessage: SysMessage;
}> {}

interface VectorDBWorkerData extends WorkerData<undefined> {}

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
