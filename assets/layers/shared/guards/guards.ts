import { SeverityLevelCodes } from '../constants';
import { type Nullable } from '../models';

const guardIsError = (txt: string): Nullable<SeverityLevelCodes> => {
  for (const value of Object.values(SeverityLevelCodes)) {
    if (txt.includes(`[${value}]`)) return value;
  }
  return null;
};
const isString = (v: unknown): v is string => typeof v === 'string';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);

const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

const isBigInt = (v: unknown): v is bigint => typeof v === 'bigint';

const isSymbol = (v: unknown): v is symbol => typeof v === 'symbol';

const isUndefined = (v: unknown): v is undefined => v === undefined;

const isNull = (v: unknown): v is null => v === null;

const hasStringProperties = <K extends string>(
  value: Record<string, unknown>,
  keys: readonly K[],
): value is Record<K, string> => {
  return keys.every((key) => typeof value[key] === 'string');
};

const hasNumberProperties = <K extends string>(
  value: Record<string, unknown>,
  keys: readonly K[],
): value is Record<K, number> => {
  return keys.every((key) => typeof value[key] === 'number');
};
export {
  guardIsError,
  hasNumberProperties,
  hasStringProperties,
  isBigInt,
  isBoolean,
  isNull,
  isNumber,
  isRecord,
  isString,
  isSymbol,
  isUndefined,
};
