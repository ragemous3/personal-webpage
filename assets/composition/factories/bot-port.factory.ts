import { Chat } from '../../layers/data/chat.data';
import { WorkerKeys } from '../../layers/data/contants/constants';
import { MessageBase } from '../../layers/data/workers/models';
import { BroadcastContract } from '../../layers/shared/contracts/broadcast-port.contract';
import { HubContract } from '../../layers/shared/contracts/hub-port.contract';
import { StateMachineConnectionContract } from '../../layers/shared/contracts/message-connection.contract';

let chat: Chat | undefined;

export const getLocalChatBot = (
  llmScriptPath: string,
  hub: HubContract,
  msgCordinator: StateMachineConnectionContract<MessageBase<unknown>, unknown>,
  broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
  singleton: boolean = true,
) => {
  if (singleton && !chat) {
    chat = new Chat(llmScriptPath, hub, msgCordinator, broadcast, WorkerKeys.LLM);
    return chat;
  }

  if (singleton && chat) return chat;

  return new Chat(llmScriptPath, hub, msgCordinator, broadcast, WorkerKeys.LLM);
};
