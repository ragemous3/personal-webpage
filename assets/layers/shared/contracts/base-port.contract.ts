import { type MessageBase } from '@/layers/data/workers/models';

export interface StandardCommunicationBaseContract<TMessage = unknown> {
  readonly name: string;
  onData(listener: (data: TMessage) => void): () => void;
  initialize(payload?: MessageBase<unknown>): void;
  send(payload: unknown, requestId?: string, action?: 'query' | 'cancel'): void;
  dispose(): void;
}
