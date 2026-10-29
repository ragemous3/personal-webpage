export type RoleTypes = 'system' | 'user' | 'assistant';
export interface ChatMessage {
  role: RoleTypes;
  content: string;
  interrupted?: boolean;
}
export interface SysMessage {
  role: 'system';
  content: string;
}
export interface UserMessage {
  role: 'user';
  content: string;
}

export interface Chunk {
  readonly text: string;
  readonly index: number;
}

export type HNSWDBEntry = {
  contents: Uint8Array;
} & HNSWDBEntryMetadata;

export interface HNSWDBEntryMetadata {
  mode: number;
  timestamp: string | Date;
}

export type Workers<T extends string> = Record<T, string>;

export interface InfraConfigurationDTO<T extends string> {
  workerMap: Workers<T>;
}
