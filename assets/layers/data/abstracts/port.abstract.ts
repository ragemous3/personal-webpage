import { createSubscribable, WritableConnections } from '../../shared/utils/subscribable';
import { StandardCommunicationBaseAbstract as StandardCommunicationBase } from './port-base.abstract';
import { isMessageBase } from '../guards/is-message-base';
import { MessageBase, StateMachineStatusLog } from '../workers/models';
import { StandardCommunicationContract } from '../../shared/contracts/port.contract';
import { HubContract } from '../../shared/contracts/hub-port.contract';
import { StateMachineConnectionContract } from '../../shared/contracts/message-connection.contract';
import { StateMachineStatesEnum } from '../contants/constants';
import { BroadcastContract } from '../../shared/contracts/broadcast-port.contract';

//TODO:// fix the statemachine from type
export abstract class StandardCommunication
  extends StandardCommunicationBase
  implements StandardCommunicationContract
{
  #$data: WritableConnections<unknown> = createSubscribable();
  constructor(
    protected source: string,
    protected hub: HubContract,
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>, unknown>,
    protected broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
    public entityName: string,
  ) {
    super(stateMachine, entityName);
    this.stateMachine.listen(this.handleStateMachineData);
    this.broadcast.listen(this.handleBroadcast);
    this.connections.push(
      this.hub.$isReady.connect((isReady: boolean) => (isReady ? this.checkAvailability() : null)),
    );
  }

  onData = (listener: (data: unknown) => void) => this.#$data.connect(listener);

  protected handleStateMachineLogs = (data: StateMachineStatusLog) => {
    if (data.initiator !== this.channelId && data.initiator !== 'announcement') return;

    //TODO:// REMOVE?
    if (data.status === StateMachineStatesEnum.BUSY) {
      console.info(`${data.entity} is ${StateMachineStatesEnum.BUSY}`);
      return;
    }
    // the whole "thing" is init by a message from state machine
    if (data.status === StateMachineStatesEnum.UNINITIALIZED) this.initialize();
  };

  protected handleBroadcast = (data: MessageBase<unknown>) => {
    const { id, task, payload } = data;
    if (id !== this.channelId) return;
    const slices = task.split(':');
    if (slices[1] === 'stream' && slices[2] === 'response') this.#$data.emit(payload);
    if (slices[1] === 'message' && slices[2] === 'response') this.#$data.emit(payload);
  };

  protected handleStateMachineData = (data: MessageBase<unknown>) => {
    const { payload } = data;
    if (this.isStateMachineStatusLog(payload)) {
      this.handleStateMachineLogs(payload);
      return;
    }
    //TODO:// FIX SO THAT WE CHECK FOR THE EXACT DTO ON EACH -> Perhaps Extract into abstract method here.
  };

  protected recieveBroadcastMessage = (data: MessageBase<unknown>) => {
    if (isMessageBase(data, (payload): payload is unknown => true)) this.handleBroadcast(data);
  };

  initialize = (): void =>
    this.hub.host({
      id: this.channelId,
      name: this.entityName,
      task: `${this.entityName}:init`,
      payload: null,
      source: this.source,
    });

  send = (payload: unknown): void =>
    this.hub.send({
      id: this.channelId,
      name: this.entityName,
      task: `${this.entityName}:query`,
      payload,
    });

  dispose = () => {
    super.dispose();
    this.#$data.disconnect();
  };
}
