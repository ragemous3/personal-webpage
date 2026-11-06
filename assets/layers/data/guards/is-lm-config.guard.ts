import { lmConfigKeys, lmDevices, lmDtypes } from '@/layers/data/contants/local-lm.constants';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { hasStringProperties, isRecord } from '@/layers/shared/guards/guards';

import { isGenerationConfig } from './is-generation-config.guard';
import { isInitConfigBase } from './is-init-config-base.guard';

const validRevision = (value: unknown): boolean =>
  value === undefined || (typeof value === 'string' && /^[a-f\d]{40}$/.test(value));

const validOnline = (value: unknown): boolean => value === undefined || typeof value === 'boolean';

export function isLmConfig(value: unknown): value is LmConfig {
  if (!isRecord(value) || !isInitConfigBase(value)) {
    return false;
  }
  const generation = value.generation;
  const revision = value.revision;
  if (![validOnline(value.online), validRevision(revision)].every(Boolean)) return false;
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
