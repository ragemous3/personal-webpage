import { type StandardCommunicationBaseContract } from '@/layers/shared/contracts/base-port.contract';

export abstract class StandardCommunicationBaseAbstract implements StandardCommunicationBaseContract {
  readonly channelId = crypto.randomUUID();
  protected connections: Array<() => void> = [];
  constructor(readonly name: string) {}
  dispose(): void {
    for (const unsubscribe of this.connections) unsubscribe();
    this.connections = [];
  }
  abstract initialize(): void;
  abstract send(payload: unknown, requestId?: string, action?: 'query' | 'cancel'): void;
  abstract onData(listener: (data: unknown) => void): () => void;
}
