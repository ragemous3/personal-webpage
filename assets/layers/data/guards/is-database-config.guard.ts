import {
  databaseNumberKeys,
  databaseStringKeys,
} from '@/layers/data/contants/local-database.constants';
import { lmDevices } from '@/layers/data/contants/local-lm.constants';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { hasNumberProperties, hasStringProperties, isRecord } from '@/layers/shared/guards/guards';

import { isInitConfigBase } from './is-init-config-base.guard';

const isDevice = (value: unknown): boolean =>
  value === undefined || (typeof value === 'string' && lmDevices.includes(value));

export const isDatabaseConfig = (value: unknown): value is DatabaseConfig => {
  if (
    !isRecord(value) ||
    !isDevice(value.device) ||
    !isInitConfigBase(value) ||
    !hasStringProperties(value, databaseStringKeys) ||
    !hasNumberProperties(value, databaseNumberKeys)
  ) {
    return false;
  }

  return (
    databaseStringKeys.every((key) => value[key].trim().length > 0) &&
    databaseNumberKeys.every(
      (key) =>
        Number.isSafeInteger(value[key]) && (key === 'seedGen' ? value[key] >= 0 : value[key] > 0),
    ) &&
    ['l2', 'ip', 'cosine'].includes(value.spaceName)
  );
};
