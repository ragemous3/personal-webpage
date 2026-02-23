import { SeverityLevelCodes } from './constants';

type SeverityLevelCodeType =
  (typeof SeverityLevelCodes)[keyof typeof SeverityLevelCodes];

type Nullable<T> = T | null;

export type { Nullable, SeverityLevelCodeType };
