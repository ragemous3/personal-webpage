import { SeverityLevelCodes } from './constants';

export type SeverityLevelCodeType = (typeof SeverityLevelCodes)[keyof typeof SeverityLevelCodes];
export type Nullable<T> = T | null;
export type AnyFunction = (...args: any[]) => any;
