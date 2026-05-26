import { type InitConfigBase } from '@/layers/data/models/chatbot-config.model';

export const isInitConfigBase = (initConfigBase: unknown): initConfigBase is InitConfigBase =>
  typeof initConfigBase === 'object' && initConfigBase !== null && 'source' in initConfigBase
    ? true
    : false;
