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

export const requireHttpDirectoryURL = (value: unknown, name: string): string => {
  const base = requireNonEmptyString(value, name).trim();
  const url = new URL(base, 'http://localhost/');
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) {
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected an HTTP directory URL for ${name}`);
  }
  return base.endsWith('/') ? base : `${base}/`;
};
