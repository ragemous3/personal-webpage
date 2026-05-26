import { lmConfigKeys } from '@/layers/data/contants/local-lm.constants';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { hasStringProperties, isRecord } from '@/layers/shared/guards/guards';

export function isLmConfig(value: unknown): value is LmConfig {
  if (!isRecord(value)) return false;

  return hasStringProperties(value, lmConfigKeys);
}
