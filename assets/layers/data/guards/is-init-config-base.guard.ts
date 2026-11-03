import { type InitConfigBase } from '@/layers/data/models/chatbot-config.model';
import { isRecord } from '@/layers/shared/guards/guards';

export const isInitConfigBase = (value: unknown): value is InitConfigBase => {
  if (!isRecord(value) || typeof value.source !== 'string' || value.source.trim().length === 0)
    return false;
  return ['modelBaseUrl', 'wasmBaseUrl'].every(
    (key) =>
      value[key] === undefined || (typeof value[key] === 'string' && value[key].trim().length > 0),
  );
};
