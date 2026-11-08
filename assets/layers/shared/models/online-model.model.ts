import { type ModelOption } from '@/layers/shared/models/model-option.model';

export interface OnlineModel extends ModelOption {
  reasoningEffort: 'low';
  maxOutputTokens: number;
}
