import { Chat, Message } from '@huggingface/transformers';
import { SearchResult } from 'hnswlib-wasm/dist/hnswlib-wasm';

import { SeverityLevelCodes } from '../../../shared/constants';
import { guardIsError } from '../../../shared/guards/guards';
import { sysPrompt } from '../constants/prompts';
import { Chunk } from '../models/models';
import { ChatbotService } from './chatbot.service';

export class RAGService extends ChatbotService {
  chunks: Chunk[] = [];
  messages: Chat = [];
  currentId: string = crypto.randomUUID();
  init = async (): Promise<undefined> => {
    console.log(`Init started`);

    this.chunks = await this.loadJSON('/content-data/chunks.json');
    // This actually downloads a file but it does not recognize it as a worker. DO ----> chrome://inspect/#workers
    const hub = new SharedWorker(new URL('/js/batch/hub.shared-worker.ts.js', import.meta.url), {
      type: 'module',
    });
    hub.port.addEventListener('message', (e: Event): void => {
      console.log(e);
    });
    hub.port.onmessageerror = (e): void => console.error(e);
    hub.onerror = (e: ErrorEvent): void => {
      console.error('hub: messageerror', e);
    };
    hub.port.start();
    hub.port.postMessage({ task: 'init', id: this.currentId });
    console.log(`Init finished`);
  };

  /* 
  sendMsg = async (msg: string) => {
    await this.vectorDBWorker.postMessage({ task: 'query' });
    this.llmWorker.postMessage({ task: 'query', data: msg });
  }; */
  /* 
  processContext = (context: Chunk[]): Message[] => {
    const strCtx: string = context.map((chunk) => chunk.text).join('\n');
    const sysPromptClone = { ...sysPrompt };
    sysPromptClone.content = `${sysPrompt.content} ${strCtx}`;
    return [sysPromptClone, ...this.messages];
  }; */
  /* 
  processMatches = (matches: SearchResult): (Chunk | undefined)[] =>
    matches.neighbors.map((neighbor) => this.chunks[neighbor]); */
}
