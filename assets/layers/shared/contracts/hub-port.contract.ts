import { type MessageBase } from '@/layers/data/workers/models';
import type { WritableStatefulConnections } from '@/layers/shared/utils/subscribable';

import type { StandardCommunicationBaseContract } from './base-port.contract';

export interface HubContract<
  TMessage = unknown,
> extends StandardCommunicationBaseContract<TMessage> {
  readonly $isReady: WritableStatefulConnections<boolean>;
  send(payload: MessageBase<TMessage>): void;
  host(payload: MessageBase<TMessage>): void;
  handleHubConnectionMsg(message: MessageBase<TMessage>): void;
}
