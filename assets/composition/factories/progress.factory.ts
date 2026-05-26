import { type ProgressInfo } from '@huggingface/transformers';

import { BroadcastKeys } from '@/layers/data/contants/constants';
import { ProgressService } from '@/layers/services/progress.service';
import { type ProgressServiceContract } from '@/layers/shared/contracts/progress-service.contract';

import { getOrCreateBroadcast } from './broadcast.factory';

export const progressFactory = (): ProgressServiceContract<Map<string, ProgressInfo>> => {
  const vectorDBBroadcastReciever = getOrCreateBroadcast(BroadcastKeys.VECTORDB);
  const chatBroadcastReciever = getOrCreateBroadcast(BroadcastKeys.LLM);
  return new ProgressService([vectorDBBroadcastReciever, chatBroadcastReciever]);
};
