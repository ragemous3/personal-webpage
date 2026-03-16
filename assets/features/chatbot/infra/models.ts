import { WorkerFileNames } from './constants';

export type WorkerFileName = (typeof WorkerFileNames)[keyof typeof WorkerFileNames];
export type ChatbotWorkers = Record<WorkerFileName, string>;
