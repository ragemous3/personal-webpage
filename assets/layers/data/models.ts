import { WorkerFileNames } from './contants/constants';
import { Task, MessageBase } from './workers/models';

export type WorkerFileName = (typeof WorkerFileNames)[keyof typeof WorkerFileNames];
export type ChatbotWorkers = Record<WorkerFileName, string>;

// TODO:// GLobal configuration, where to put it?
export type GlobalConfig = {
  BASE_URL: string;
  LLM_MODELS: {
    DEFAULT: string;
  };
  WORKER_NAMES: ChatbotWorkers;
  PAGE_PARAMS: Record<string, unknown>;
  SITE_PARAMS: Record<string, unknown>;
};
export type WorkerKeys = keyof typeof WorkerFileNames;
