import { type ChatMessage } from '@/layers/shared/contracts/chatbot-service.contract';
import { type ChatGenerationState } from '@/layers/shared/models/chat-generation.model';
import { type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';

export interface ChatGenerationContract {
  readonly stateSubscription: ReadonlyStatefulConnections<ChatGenerationState>;
  initialize(): void;
  generate(
    messages: readonly ChatMessage[],
    onText: (text: string) => void,
    requestId: string,
  ): Promise<string>;
  cancel(requestId: string): void;
  dispose(): void;
}
