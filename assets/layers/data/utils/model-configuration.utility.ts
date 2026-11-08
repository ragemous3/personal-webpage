import { isRecord } from '@/layers/shared/guards/guards';

export const withoutGeneration = (value: unknown): unknown =>
  isRecord(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'generation'))
    : value;
