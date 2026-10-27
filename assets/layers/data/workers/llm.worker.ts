import {
  pipeline,
  type ProgressInfo,
  type TextGenerationPipeline,
} from '@huggingface/transformers';

import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { LocalLLMData } from '@/layers/data/llm.data';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { TokenizerUtility } from '@/layers/shared/utils/tokenizer';

import { type LlmDTO, type MessageBase } from './models';

interface LlmWorkerDependencies {
  loadGeneratorPipeline: (
    config: LmConfig,
    progress: (value: ProgressInfo) => void,
  ) => Promise<TextGenerationPipeline>;
  loadTokenizer: (model: string) => Promise<TokenizerUtility>;
  publish: (message: unknown) => void;
}

const defaultDependencies: LlmWorkerDependencies = {
  loadGeneratorPipeline: (config, progress) =>
    pipeline('text-generation', config.model, {
      device: config.device,
      dtype: config.dtype,
      progress_callback: progress,
    }),
  loadTokenizer: async (model) => {
    const tokenizer = new TokenizerUtility(model);
    await tokenizer.initTokenizer();
    return tokenizer;
  },
  publish: (message) => postMessage(message),
};

const isLlmDto = (value: unknown): value is LlmDTO =>
  typeof value === 'object' && value !== null && 'message' in value && Array.isArray(value.message);

const loadModel = async (
  dependencies: LlmWorkerDependencies,
  config: LmConfig,
  request: MessageBase<unknown>,
): Promise<LocalLLMData> => {
  const generator = await dependencies.loadGeneratorPipeline(config, (progress) => {
    dependencies.publish({
      id: request.id,
      name: request.name,
      task: 'llm:progress',
      payload: progress,
    });
  });
  const tokenizer = await dependencies.loadTokenizer(config.model);
  return new LocalLLMData(generator, tokenizer, tokenizer.getMaxLength(), config.generation);
};

export const createLlmMessageHandler = (dependencies: LlmWorkerDependencies) => {
  let localLLM: LocalLLMData | undefined;
  let initialization: Promise<LocalLLMData> | undefined;

  const handleInit = async (request: MessageBase<unknown>): Promise<void> => {
    const { payload } = request;
    if (!isLmConfig(payload)) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid language model configuration.`);
    }
    if (localLLM) {
      dependencies.publish({ ...request, task: 'llm:ready' });
      return;
    }

    initialization ??= loadModel(dependencies, payload, request).then(
      (instance) => {
        localLLM = instance;
        return instance;
      },
      (error: unknown) => {
        initialization = undefined;
        throw error;
      },
    );
    await initialization;
    dependencies.publish({ ...request, task: 'llm:ready' });
  };

  const handleQuery = async (request: MessageBase<unknown>): Promise<void> => {
    if (!localLLM) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Language model is not ready.`);
    }
    if (!isLlmDto(request.payload) || request.payload.message.length === 0) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a populated chat message array.`);
    }

    const final = await localLLM.chatMessageHandler(request.payload.message, (text) => {
      dependencies.publish({
        id: request.id,
        name: request.name,
        task: 'llm:stream:response',
        payload: text,
      });
    });
    dependencies.publish({
      id: request.id,
      name: request.name,
      task: 'llm:message:response',
      payload: final,
    });
  };

  return async (event: MessageEvent<MessageBase<unknown>>) => {
    const request = event.data;
    try {
      if (request.task === 'llm:init') await handleInit(request);
      if (request.task === 'llm:query') await handleQuery(request);
    } catch (error) {
      dependencies.publish({
        ...request,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : {
                name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
                message: String(error),
                stack: null,
              },
      });
    }
  };
};

if ('importScripts' in globalThis) {
  const handleMessage = createLlmMessageHandler(defaultDependencies);
  globalThis.addEventListener('message', (event) => {
    void handleMessage(event as MessageEvent<MessageBase<unknown>>);
  });
}
