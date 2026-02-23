import { Chat } from '@huggingface/transformers';

import { LLMWorkerData } from '../models/models';
import { LocalLLMService } from '../services/llm.service';

const localLLM = new LocalLLMService();

self.onmessage = async (options: MessageEvent<LLMWorkerData>) => {
  console.info('Worker: Message received from main script');
  const { task, chatMessages, sysMessage }: LLMWorkerData = options.data;
  if (task === 'init') {
    await localLLM.init();
  }

  if (chatMessages && task === 'query') {
    const chatWithSys: Chat = [sysMessage, ...chatMessages];
    try {
      await localLLM.chatWithBot(chatWithSys, async (txt: string) =>
        postMessage(txt),
      );
    } catch (err: unknown) {
      postMessage({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
