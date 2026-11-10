import { type ChatMessage } from '@/layers/shared/contracts/chatbot-service.contract';
import {
  type ChatGenerationEvent,
  type ChatGenerationState,
} from '@/layers/shared/models/chat-generation.model';
import {
  type ReadonlyConnections,
  type ReadonlyStatefulConnections,
} from '@/layers/shared/utils/subscribable';

export interface ChatGenerationContract {
  readonly generationSubscription: ReadonlyConnections<ChatGenerationEvent>;
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
