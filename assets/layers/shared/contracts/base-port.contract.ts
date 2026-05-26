import { type MessageBase } from '../../data/workers/models';

export interface StandardCommunicationBaseContract<TMessage = unknown> {
  readonly name: string;
  onData(listener: (data: TMessage) => void): void;
  initialize(payload: MessageBase<unknown>): void;
  send(payload: unknown): void;
  dispose(): void;
}
