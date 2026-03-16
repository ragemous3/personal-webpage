import { Nullable } from '../../../shared/models';
import { WorkerMessageBase } from '../../../shared/workers/models';
import { ChatMessage } from '../models/models';

export interface LlmDTO extends WorkerMessageBase<Nullable<ChatMessage[]>> {}

export interface VectorDbDto extends WorkerMessageBase<
  Nullable<{
    topK?: number;
    query: string;
  }>
> {}

export type WorkerMessageHubPayload = Nullable<{
  llm?: LlmDTO;
  vector?: VectorDbDto;
}>;

export interface WorkerMessageHub<Config> extends WorkerMessageBase<WorkerMessageHubPayload> {
  config: Config;
}
