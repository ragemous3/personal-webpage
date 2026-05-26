import { type WorkerFileNames } from '@/layers/data/contants/constants';

export interface SysMessageConfig {
  offline: string;
  online: string;
}
export interface ChatbotConfig {
  sysmessage: SysMessageConfig;
}
export interface SiteConfigurationGlobal {
  PAGE_PARAMS: Record<string, unknown>;
  SITE_PARAMS: Record<string, unknown>;
  WORKER_NAMES: Record<(typeof WorkerFileNames)[keyof typeof WorkerFileNames], string>;
}
