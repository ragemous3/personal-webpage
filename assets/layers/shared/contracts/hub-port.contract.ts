import { MessageBase } from '../../data/workers/models';
import type { WritableStatefulConnections } from '../../shared/utils/subscribable';
import type { StandardCommunicationBaseContract } from './base-port.contract';

export interface HubContract<
  TMessage = unknown,
> extends StandardCommunicationBaseContract<TMessage> {
  readonly $isReady: WritableStatefulConnections<boolean>;
  send(payload: MessageBase<TMessage>): void;
  host(payload: MessageBase<TMessage>): void;
  handleHubConnectionMsg(msg: MessageBase<TMessage>): void;
}
