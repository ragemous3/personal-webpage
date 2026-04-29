import { TextGenerationConfig } from '@huggingface/transformers';

export type GenerationConfig = TextGenerationConfig;
export type RoleTypes = 'system' | 'user' | 'assistant';
export type ChatMessage = { role: RoleTypes; content: string };
export type SysMessage = { role: 'system'; content: string };
export type UserMessage = { role: 'user'; content: string };

export interface Chunk {
  readonly text: string;
  readonly index: number;
}

export interface HNSWDBEntry {
  timestamp: string | Date;
  mode: number;
  contents: Uint8Array;
}

export type RAGStatus = {
  status: RagStates;
};

export type Workers<T extends string> = Record<T, string>;

export type InfraConfigurationDTO<T extends string> = {
  workerMap: Workers<T>;
};
