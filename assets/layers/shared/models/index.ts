import { type SeverityLevelCodes } from '@/layers/shared/constants';

export type SeverityLevelCodeType = (typeof SeverityLevelCodes)[keyof typeof SeverityLevelCodes];
export type Nullable<T> = T | null;
