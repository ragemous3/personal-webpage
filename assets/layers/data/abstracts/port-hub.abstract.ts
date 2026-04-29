import { StandardCommunicationBaseAbstract } from './port-base.abstract';
import {
  createStatefulSubscribable,
  WritableStatefulConnections,
} from '../../shared/utils/subscribable';
import { HubConnection } from '../hub.connection';
import { MessageBase } from '../workers/models';
import { HubContract } from '../../shared/contracts/hub-port.contract';
import { StateMachineConnectionContract } from '../../shared/contracts/message-connection.contract';
import { StateMachineStatesEnum } from '../contants/constants';
import { BroadcastContract } from '../../shared/contracts/broadcast-port.contract';

export abstract class HubAbstract extends StandardCommunicationBaseAbstract implements HubContract {
  $isReady: WritableStatefulConnections<boolean> = createStatefulSubscribable();
  #$data: WritableStatefulConnections<boolean> = createStatefulSubscribable();
  //TODO: Need to create a contract for HubConnection
  constructor(
    protected hub: HubConnection,
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>, unknown>,
    protected broadcasts: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>[],
    public entityName: string,
  ) {
    super(stateMachine, entityName);
    this.stateMachine.listen(this.handleStateMachineData);
    this.hub.listen(this.handleHubConnectionMsg);
  }

  public onData = (listener: (data: unknown) => void) => this.#$data.connect(listener);

  public handleHubConnectionMsg = (msg: MessageBase<unknown>) => {
    if (msg?.error) {
      console.error(msg.error);
      return;
    }
    if (msg.task === 'hub:ping') {
      //Signaling that its OK to connect to hub - ping bounced back.
      this.$isReady.emit(true);
      return;
    }
    this.broadcasts.forEach((broadcast) => {
      if (msg.name === broadcast.name) broadcast.send(msg);
    });
  };

  protected handleStateMachineData = (data: MessageBase<unknown>) => {
    if (!this.isStateMachineStatusLog(data.payload)) return;

    const payload = data.payload;

    if (payload.initiator !== this.channelId && payload.initiator !== 'announcement') return;
    if (payload.status === StateMachineStatesEnum.BUSY) {
      console.info(`${payload.entity} is ${StateMachineStatesEnum.BUSY}`);
    }
    if (payload.status === StateMachineStatesEnum.UNINITIALIZED) this.initialize();
  };

  initialize = () =>
    this.hub.initialize({
      task: 'hub:ping',
      name: this.entityName,
      payload: null,
      id: this.channelId,
    });

  host = (payload: MessageBase<unknown>): void => {
    this.hub.send({
      task: 'hub:host',
      name: this.entityName,
      payload,
      id: this.channelId,
    });
  };

  send = (payload: MessageBase<unknown>): void => {
    this.hub.send({
      task: 'hub:query',
      name: this.entityName,
      payload,
      id: this.channelId,
    });
  };
}
