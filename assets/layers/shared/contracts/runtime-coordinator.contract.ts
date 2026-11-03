import { type MessageBase } from '@/layers/data/workers/models';
import { type RuntimeRole } from '@/layers/shared/models/runtime.model';
import { type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';

export interface RuntimeLifecycleContract {
  onData?(listener: (data: unknown) => void): () => void;
  begin(requestId: string): Promise<void>;
  finish(requestId: string): void;
  reconnect(): Promise<void>;
}
export interface RuntimeCoordinatorContract extends RuntimeLifecycleContract {
  readonly $isReady: ReadonlyStatefulConnections<boolean>;
  host(message: MessageBase<unknown>): void;
  send(message: MessageBase<unknown>): void;
  release(id: string, role: string): void;
  onData(listener: (data: unknown) => void): () => void;
  configure(configurations: Partial<Record<RuntimeRole, unknown>>): Promise<void>;
}
