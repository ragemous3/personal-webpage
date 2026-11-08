import { Chat } from '@/layers/data/local-chat-lm.data';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

let chat: Chat | undefined;
export const getLocalChatBot = (
  runtime: RuntimeCoordinatorContract,
  config: RagConfigBase<LmConfig>,
  singleton = true,
  autoStart = true,
): Chat => {
  if (singleton && chat) return chat;
  const result = new Chat(runtime, config, autoStart);
  if (singleton) chat = result;
  return result;
};
