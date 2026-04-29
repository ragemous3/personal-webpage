import { MessageBase } from '../../data/workers/models';

export interface StandardCommunicationBaseContract<TMessage = unknown> {
  readonly entityName: string;
  onData(listener: (data: TMessage) => void): void;
  initialize(payload: MessageBase<unknown>): void;
  send(payload: unknown): void;
  dispose(): void;
}
