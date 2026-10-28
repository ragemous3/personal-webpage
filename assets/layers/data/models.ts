import { type WorkerFileNames } from './contants/constants';

export type WorkerFileName = (typeof WorkerFileNames)[keyof typeof WorkerFileNames];
export type ChatbotWorkers = Record<WorkerFileName, string>;

// TODO:// GLobal configuration, where to put it?
export interface GlobalConfig {
  BASE_URL: string;
  LLM_MODELS: {
    DEFAULT: string;
  };
  WORKER_NAMES: ChatbotWorkers;
  PAGE_PARAMS: Record<string, unknown>;
  SITE_PARAMS: Record<string, unknown>;
}
export type WorkerKeys = keyof typeof WorkerFileNames;
