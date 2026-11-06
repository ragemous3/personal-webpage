import { type ChatHistoryRepositoryContract } from '@/layers/shared/contracts/chat-history-repository.contract';
import { type RuntimeLifecycleContract } from '@/layers/shared/contracts/runtime-coordinator.contract';

export interface ChatSessionContract {
  readonly conversationId: string;
  readonly history: ChatHistoryRepositoryContract;
  readonly runtime?: RuntimeLifecycleContract;
}
