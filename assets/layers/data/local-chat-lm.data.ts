import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type HubContract } from '@/layers/shared/contracts/hub-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

import { StandardCommunication } from './abstracts/standard-communication.abstract';
import { type MessageBase } from './workers/models';

export class Chat extends StandardCommunication {
  constructor(
    protected hub: HubContract,
    protected stateMachine: StateMachineConnectionContract<
      MessageBase<unknown>,
      MessageBase<unknown>
    >,
    protected broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
    public configuration: RagConfigBase<LmConfig>,
  ) {
    super(hub, stateMachine, broadcast, configuration);
  }
}
