import { type DatabaseConfig, type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type AssistantSettings } from '@/layers/shared/contracts/configuration-service.contract';
import { isRecord } from '@/layers/shared/guards/guards';

export interface BotConfiguration {
  settings: AssistantSettings;
  model: LmConfig;
  database: DatabaseConfig;
}

export interface BotEnvelope {
  task: string;
  payload?: unknown;
  requestId?: string | undefined;
  error?: unknown;
}

export interface SharedBotState {
  selected?: AssistantSettings;
  active?: AssistantSettings;
  pending: boolean;
  loading: boolean;
  ready: boolean;
  error?: string | undefined;
}

export interface BotWireMessage {
  kind: 'assistant';
  client: string;
  action: 'register' | 'claim' | 'configure' | 'load' | 'loaded' | 'request' | 'run' | 'reply' | 'event' | 'finish' | 'disconnect' | 'state';
  epoch?: number | undefined;
  revision?: number | undefined;
  configuration?: BotConfiguration;
  state?: SharedBotState;
  channel?: 'llm' | 'vectordb';
  message?: BotEnvelope;
  error?: string;
}

export type BotPort = Pick<MessagePort, 'postMessage'>;

const actions = new Set(['register', 'claim', 'configure', 'load', 'loaded', 'request', 'run', 'reply', 'event', 'finish', 'disconnect', 'state']);

export const isBotWireMessage = (value: unknown): value is BotWireMessage =>
  isRecord(value) && value.kind === 'assistant' && typeof value.client === 'string' &&
  typeof value.action === 'string' && actions.has(value.action);
