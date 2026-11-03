import { type RuntimeMessage } from '@/layers/shared/models/runtime.model';

export interface SharedModelDriverContract {
  handle(event: MessageEvent<RuntimeMessage>): Promise<void>;
  dispose(): Promise<void>;
}
