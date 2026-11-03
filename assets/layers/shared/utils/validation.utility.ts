import { SeverityLevelCodes } from '@/layers/shared/constants';
import { isRecord, isString } from '@/layers/shared/guards/guards';

export const requireRecord = (value: unknown, name: string): Record<string, unknown> => {
  if (!isRecord(value) || Array.isArray(value)) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected an object for ${name}`);
  }
  return value;
};

export const requireNonEmptyString = (value: unknown, name: string): string => {
  if (!isString(value) || value.trim().length === 0) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a nonempty string for ${name}`);
  }
  return value;
};
