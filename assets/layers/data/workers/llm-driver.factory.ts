import {
  InterruptableStoppingCriteria,
  pipeline,
} from '@huggingface/transformers';

import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { LocalLLMData } from '@/layers/data/llm.data';
import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type LlmWorkerDependencies } from '@/layers/data/models/llm-driver.model';
import { withoutGeneration } from '@/layers/data/utils/model-configuration.utility';
import { configureModelEnvironment } from '@/layers/data/utils/model-environment.utility';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type SharedModelDriverContract } from '@/layers/shared/contracts/shared-model-driver.contract';
import { TokenizerUtility } from '@/layers/shared/utils/tokenizer';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

import { type LlmDTO, type MessageBase } from './models';

const defaultDependencies: LlmWorkerDependencies = {
  loadGeneratorPipeline: async (config, progress) => {
    configureModelEnvironment(config);
    const generator = await pipeline<'text-generation'>('text-generation', config.model, {
      ...(config.revision ? { revision: config.revision } : {}),
      device: config.device,
      dtype: config.dtype,
      progress_callback: progress,
    });
    const forward = generator.model.forward.bind(generator.model);
    generator.model.forward = async (...arguments_: Parameters<typeof forward>) => {
      const result: unknown = await forward(...arguments_);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return result;
    };
    return generator;
  },
  loadTokenizer: async (model, revision) => {
    const tokenizer = new TokenizerUtility(model, revision);
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
  try {
    const tokenizer = await dependencies.loadTokenizer(config.model, config.revision);
    return new LocalLLMData(generator, tokenizer, tokenizer.getMaxLength(), config.generation);
  } catch (error) {
    await generator.dispose();
    throw error;
  }
};

const createGenerationQueue = (
  dependencies: LlmWorkerDependencies,
  getModel: () => LocalLLMData | undefined,
) => {
  const pending = new Map<string, { owner: string; stopping: InterruptableStoppingCriteria }>();
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
    const key = `${request.id}:${request.requestId ?? request.id}`;
    if (request.task === 'llm:cancel') {
      const entry = pending.get(key);
      if (entry?.owner === request.id) entry.stopping.interrupt();
      return;
    }
    const stopping = new InterruptableStoppingCriteria();
    pending.set(key, { owner: request.id, stopping });
    const next = generation.then(() => runQuery(request, stopping));
    generation = next.catch(Boolean);
    try {
      await next;
    } finally {
      pending.delete(key);
    }
  };
};

export const createLlmMessageHandler = (
  dependencies: LlmWorkerDependencies,
): SharedModelDriverContract['handle'] & { dispose: SharedModelDriverContract['dispose'] } => {
  let localLLM: LocalLLMData | undefined;
  let initialization: Promise<LocalLLMData> | undefined;
  let activeConfiguration: LmConfig | undefined;
  const handleGeneration = createGenerationQueue(dependencies, () => localLLM);

  const handleInit = async (request: MessageBase<unknown>): Promise<void> => {
    const { payload } = request;
    if (!isLmConfig(payload))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid language model configuration.`);
    if (activeConfiguration && !areValuesEqual(withoutGeneration(activeConfiguration), withoutGeneration(payload))) {
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
    localLLM?.configure(payload.generation);
    activeConfiguration = payload;
    dependencies.publish({ ...request, task: 'llm:ready' });
  };

  const handle = async (event: MessageEvent<MessageBase<unknown>>): Promise<void> => {
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
                stack: undefined,
              },
      });
    }
  };
  return Object.assign(handle, {
    dispose: async (): Promise<void> => {
      await localLLM?.dispose();
      localLLM = undefined;
      initialization = undefined;
      activeConfiguration = undefined;
    },
  });
};

export const createLlmDriver = (publish: (message: unknown) => void): SharedModelDriverContract => {
  const handle = createLlmMessageHandler({ ...defaultDependencies, publish });
  return { handle, dispose: handle.dispose };
};
