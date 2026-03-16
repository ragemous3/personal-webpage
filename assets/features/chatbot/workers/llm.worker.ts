import { ProgressInfo } from '@huggingface/transformers';
import { LocalLLMService } from '../services/llm.service';
import { LlmDTO } from './models';

const localLLM = new LocalLLMService();

const progressTracker = (progress: ProgressInfo) => {
  postMessage({ task: 'bus:progress', payload: progress });
};

onmessage = async (options: MessageEvent<LlmDTO>) => {
  console.info('Worker: Message received from main script');
  const { task, payload }: LlmDTO = options.data;

  const chatMessages = payload;

  if (task === 'llm:init') {
    await localLLM.init(progressTracker);
    postMessage('llm:ready');
  }

  if (chatMessages && task === 'llm:query') {
    try {
      await localLLM.chatWithBot(chatMessages, async (txt: string) => postMessage(txt));
    } catch (err: unknown) {
      postMessage({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
};
