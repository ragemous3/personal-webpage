import { Chat } from '@/layers/data/local-chat-lm.data';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type MessageBase } from '@/layers/data/workers/models';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type HubContract } from '@/layers/shared/contracts/hub-port.contract';
import { type StateMachineConnectionContract } from '@/layers/shared/contracts/message-connection.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

let chat: Chat | undefined;

export const getLocalChatBot = (
  hub: HubContract,
  messageCordinator: StateMachineConnectionContract<MessageBase<unknown>, MessageBase<unknown>>,
  broadcast: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>,
  config: RagConfigBase<LmConfig>,
  singleton = true,
): Chat => {
  if (singleton && !chat) {
    chat = new Chat(hub, messageCordinator, broadcast, config);
    return chat;
  }

  if (singleton && chat) return chat;

  return new Chat(hub, messageCordinator, broadcast, config);
};
