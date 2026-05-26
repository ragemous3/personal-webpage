import { StateMachineStatesEnum } from '@/layers/data/contants/constants';
import { isMessageBase } from '@/layers/data/guards/is-message-base.guard';
import { type MessageBase, type StateMachineStatusLog } from '@/layers/data/workers/models';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type HubContract } from '@/layers/shared/contracts/hub-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';
import { type StandardCommunicationContract } from '@/layers/shared/contracts/port.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';
import { createSubscribable, type WritableConnections } from '@/layers/shared/utils/subscribable';

import { StandardCommunicationBaseAbstract } from './standard-communication-base.abstract';

export abstract class StandardCommunication
  extends StandardCommunicationBaseAbstract
  implements StandardCommunicationContract
{
  readonly #$data: WritableConnections<unknown> = createSubscribable();

  constructor(
    protected hub: HubContract,
    protected stateMachine: StateMachineConnectionContract<
      MessageBase<unknown>,
      MessageBase<unknown>
    >,
    protected broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
    public configuration: RagConfigBase<unknown>,
  ) {
    super(stateMachine, configuration.name);
    this.stateMachine.listen(this.handleStateMachineData);
    this.broadcast.listen(this.handleBroadcast);
    this.connections.push(
      this.hub.$isReady.connect((isReady: boolean): void =>
        isReady ? this.checkAvailability() : undefined,
      ),
    );
  }

  onData = (listener: (data: unknown) => void): (() => void) => this.#$data.connect(listener);

  initialize = (): void => {
    this.hub.host({
      id: this.channelId,
      name: this.name,
      task: `${this.name}:init`,
      payload: this.configuration.payload,
    });
  };

  send = (payload: unknown): void => {
    this.hub.send({
      id: this.channelId,
      name: this.name,
      task: `${this.name}:query`,
      payload,
    });
  };

  dispose = (): void => {
    super.dispose();
    this.#$data.disconnect();
  };

  protected handleStateMachineLogs = (data: StateMachineStatusLog): void => {
    if (data.initiator !== this.channelId && data.initiator !== 'announcement') return;
    if (data.status === StateMachineStatesEnum.BUSY) {
      console.info(`${data.entity} is ${StateMachineStatesEnum.BUSY}`);
      return;
    }
    // For now check is not necessary but might be in the future.
    this.initialize();
  };

  protected handleBroadcast = (data: MessageBase<unknown>): void => {
    const { id, task, payload } = data;
    if (id !== this.channelId) return;
    const slices = task.split(':');
    if (slices[1] === 'stream' && slices[2] === 'response') this.#$data.emit(payload);
    if (slices[1] === 'message' && slices[2] === 'response') this.#$data.emit(payload);
  };

  protected handleStateMachineData = (data: MessageBase<unknown>): void => {
    const { payload } = data;
    if (this.isStateMachineStatusLog(payload)) {
      this.handleStateMachineLogs(payload);
      return;
    }
  };

  protected recieveBroadcastMessage = (data: MessageBase<unknown>): void => {
    if (isMessageBase(data, (payload): payload is unknown => true)) this.handleBroadcast(data);
  };
}
