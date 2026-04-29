import { StandardCommunicationBaseContract } from '../../shared/contracts/base-port.contract';
import { StateMachineConnectionContract } from '../../shared/contracts/message-connection.contract';
import { MessageBase, StateMachineStatusLog } from '../workers/models';

export abstract class StandardCommunicationBaseAbstract implements StandardCommunicationBaseContract {
  channelId = crypto.randomUUID();
  protected connections: (() => void)[] = [];

  constructor(
    protected stateMachine: StateMachineConnectionContract<MessageBase<unknown>, unknown>,
    public entityName: string,
  ) {}

  checkAvailability = (entityName: string = this.entityName) =>
    this.stateMachine.send({
      id: this.channelId,
      name: this.entityName,
      task: `${entityName}:check`,
      payload: null,
    });

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
  dispose(): void {
    this.connections.forEach((unsub) => unsub());
  }
}
