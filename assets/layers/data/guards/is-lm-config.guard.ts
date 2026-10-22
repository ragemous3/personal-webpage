import { lmConfigKeys, lmDevices, lmDtypes } from '@/layers/data/contants/local-lm.constants';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { hasStringProperties, isRecord } from '@/layers/shared/guards/guards';

import { isGenerationConfig } from './is-generation-config.guard';

export function isLmConfig(value: unknown): value is LmConfig {
  if (!isRecord(value)) {
    return false;
  }
  const generation = value.generation;
  if (!hasStringProperties(value, lmConfigKeys)) {
    return false;
  }

  return (
    lmConfigKeys.every((key) => value[key].trim().length > 0) &&
    lmDevices.includes(value.device) &&
    lmDtypes.includes(value.dtype) &&
    isGenerationConfig(generation)
  );
}
