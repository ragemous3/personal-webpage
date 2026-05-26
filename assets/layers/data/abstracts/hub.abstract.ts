import { StateMachineStatesEnum } from '@/layers/data/contants/constants';
import { type HubConnection } from '@/layers/data/hub.connection';
import { type MessageBase } from '@/layers/data/workers/models';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type HubContract } from '@/layers/shared/contracts/hub-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';
import {
  createStatefulSubscribable,
  type WritableStatefulConnections,
} from '@/layers/shared/utils/subscribable';

import { StandardCommunicationBaseAbstract } from './standard-communication-base.abstract';

export abstract class HubAbstract extends StandardCommunicationBaseAbstract implements HubContract {
  $isReady: WritableStatefulConnections<boolean> = createStatefulSubscribable();
  readonly #$data: WritableStatefulConnections<boolean> = createStatefulSubscribable();
  constructor(
    protected hub: HubConnection,
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>>,
    protected broadcasts: Array<BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>>,
    public name: string,
  ) {
    super(stateMachine, name);
    this.stateMachine.listen(this.handleStateMachineData);
    this.hub.listen(this.handleHubConnectionMsg);
  }

  initialize = (): void => {
    this.hub.initialize({
      task: 'hub:ping',
      name: this.name,
      payload: null,
      id: this.channelId,
    });
  };

  host = (payload: MessageBase<unknown>): void => {
    this.hub.send({
      task: 'hub:host',
      name: this.name,
      payload,
      id: this.channelId,
    });
  };

  send = (payload: MessageBase<unknown>): void => {
    this.hub.send({
      task: 'hub:query',
      name: this.name,
      payload,
      id: this.channelId,
    });
  };

  onData = (listener: (data: unknown) => void): (() => void) => this.#$data.connect(listener);

  handleHubConnectionMsg = (message: MessageBase<unknown>): null | void => {
    if (message?.error) {
      console.error(message.error);
      return null;
    }
    if (message.task === 'hub:ping') {
      //Signaling that its OK to connect to hub - ping bounced back.
      this.$isReady.emit(true);
      return;
    }
    for (const broadcast of this.broadcasts) {
      if (message.name === broadcast.name) broadcast.send(message);
    }
  };

  protected handleStateMachineData = (data: MessageBase<unknown>): void => {
    if (!this.isStateMachineStatusLog(data.payload)) return;

    const payload = data.payload;

    if (payload.initiator !== this.channelId && payload.initiator !== 'announcement') return;
    if (payload.status === StateMachineStatesEnum.BUSY) {
      console.info(`${payload.entity} is ${StateMachineStatesEnum.BUSY}`);
    }
    if (payload.status === StateMachineStatesEnum.UNINITIALIZED) this.initialize();
  };
}
