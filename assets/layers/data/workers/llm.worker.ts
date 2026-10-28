import {
  InterruptableStoppingCriteria,
  pipeline,
  type ProgressInfo,
  type TextGenerationPipeline,
} from '@huggingface/transformers';

import { isGenerationConfig } from '@/layers/data/guards/is-generation-config.guard';
import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { LocalLLMData } from '@/layers/data/llm.data';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { TokenizerUtility } from '@/layers/shared/utils/tokenizer';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

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

const isLlmDto = (value: unknown): value is LlmDTO => {
  if (typeof value !== 'object' || value === null || !('message' in value) || !Array.isArray(value.message)) return false;
  return !('generation' in value) || isGenerationConfig(value.generation);
};

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

const createGenerationQueue = (
  dependencies: LlmWorkerDependencies,
  getModel: () => LocalLLMData | undefined,
) => {
  const pending = new Map<string, { owner: string; stopping: InterruptableStoppingCriteria; done: Promise<unknown> }>();
  let generation: Promise<unknown> = Promise.resolve();
  const runQuery = async (
    request: MessageBase<unknown>,
    stopping: InterruptableStoppingCriteria,
  ): Promise<void> => {
    const interrupted = (): boolean => stopping.interrupted;
    if (interrupted()) return;
    const localLLM = getModel();
    if (!localLLM) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Language model is not ready.`);
    }
    if (!isLlmDto(request.payload) || request.payload.message.length === 0) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a populated chat message array.`);
    }

    const final = await localLLM.chatMessageHandler(
      request.payload.message,
      (text) => {
        if (stopping.interrupted) return;
        dependencies.publish({
          id: request.id,
          ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
          name: request.name,
          task: 'llm:stream:response',
          payload: text,
        });
      },
      stopping,
      request.payload.generation,
    );
    if (interrupted()) return;
    dependencies.publish({
      id: request.id,
      ...(request.requestId === undefined ? {} : { requestId: request.requestId }),
      name: request.name,
      task: 'llm:message:response',
      payload: final,
    });
  };

  return async (request: MessageBase<unknown>): Promise<void> => {
    const key = request.requestId ?? request.id;
    if (request.task === 'llm:cancel') {
      const entry = pending.get(key);
      if (entry && entry.owner !== request.id) return;
      entry?.stopping.interrupt();
      await entry?.done.catch(Boolean);
      dependencies.publish({ ...request, task: 'llm:cancel:response' });
      return;
    }
    const stopping = new InterruptableStoppingCriteria();
    const next = generation.then(() => runQuery(request, stopping));
    pending.set(key, { owner: request.id, stopping, done: next });
    generation = next.catch(Boolean);
    try {
      await next;
    } finally {
      pending.delete(key);
    }
  };
};

export const createLlmMessageHandler = (dependencies: LlmWorkerDependencies) => {
  let localLLM: LocalLLMData | undefined;
  let initialization: Promise<LocalLLMData> | undefined;
  let activeConfiguration: LmConfig | undefined;
  const handleGeneration = createGenerationQueue(dependencies, () => localLLM);

  const handleInit = async (request: MessageBase<unknown>): Promise<void> => {
    const { payload } = request;
    if (!isLmConfig(payload))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid language model configuration.`);
    if (activeConfiguration && !areValuesEqual(activeConfiguration, payload)) {
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - Model initialized with a different configuration.`,
      );
    }
    if (!localLLM) {
      activeConfiguration = payload;
      initialization ??= loadModel(dependencies, payload, request).then(
        (instance) => {
          localLLM = instance;
          return instance;
        },
        (error: unknown) => {
          initialization = undefined;
          activeConfiguration = undefined;
          throw error;
        },
      );
      await initialization;
    }
    dependencies.publish({ ...request, task: 'llm:ready' });
  };

  return async (event: MessageEvent<MessageBase<unknown>>) => {
    const request = event.data;
    try {
      if (request.task === 'llm:init') await handleInit(request);
      if (request.task === 'llm:cancel' || request.task === 'llm:query')
        await handleGeneration(request);
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
