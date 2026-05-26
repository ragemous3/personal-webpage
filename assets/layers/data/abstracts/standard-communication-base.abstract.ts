import { type MessageBase, type StateMachineStatusLog } from '@/layers/data/workers/models';
import { type StandardCommunicationBaseContract } from '@/layers/shared/contracts/base-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';

export abstract class StandardCommunicationBaseAbstract implements StandardCommunicationBaseContract {
  channelId = crypto.randomUUID();
  protected connections: Array<() => void> = [];

  constructor(
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>>,
    public name: string,
  ) {}

  checkAvailability = (entityName: string = this.name): void => {
    this.stateMachine.send({
      id: this.channelId,
      name: this.name,
      task: `${entityName}:check`,
      payload: null,
    });
  };

  dispose(): void {
    for (const unsub of this.connections) unsub();
  }

  protected isStateMachineStatusLog = (payload: unknown): payload is StateMachineStatusLog =>
    payload &&
    typeof payload === 'object' &&
    'entity' in payload &&
    'initiator' in payload &&
    'status' in payload
      ? true
      : false;
  //Listen to messages from Broadcast
  protected abstract handleStateMachineData(data: MessageBase<unknown>): void;
  abstract initialize(payload: MessageBase<unknown>): void;
  abstract send(payload: MessageBase<unknown>): void;
  abstract onData(listener: (data: unknown) => void): void;
}
