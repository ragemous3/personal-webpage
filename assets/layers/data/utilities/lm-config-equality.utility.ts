import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

export const areLmConfigsEqual = (left: LmConfig, right: LmConfig): boolean =>
  left.source === right.source &&
  left.model === right.model &&
  left.device === right.device &&
  left.dtype === right.dtype &&
  areValuesEqual(left.generation, right.generation);
