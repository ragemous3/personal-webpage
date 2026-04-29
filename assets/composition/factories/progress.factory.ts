import { ProgressInfo } from '@huggingface/transformers';
import { BroadcastKeys } from '../../layers/data/contants/constants';
import { MessageBase } from '../../layers/data/workers/models';
import { ProgressService } from '../../layers/services/progress.service';
import { ProgressServiceContract } from '../../layers/shared/contracts/progress-service.contract';
import { getOrCreateBroadcast } from './broadcast.factory';

export const progressFactory = (): ProgressServiceContract<Map<string, ProgressInfo>> => {
  const vectorDBBroadcastReciever = getOrCreateBroadcast<
    MessageBase<unknown>,
    MessageBase<unknown>
  >(BroadcastKeys.VECTORDB);
  const chatBroadcastReciever = getOrCreateBroadcast<MessageBase<unknown>, MessageBase<unknown>>(
    BroadcastKeys.LLM,
  );
  return new ProgressService([vectorDBBroadcastReciever, chatBroadcastReciever]);
};
