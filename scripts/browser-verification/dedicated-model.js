import { pipeline } from '@huggingface/transformers';

import { createLlmMessageHandler } from '@/layers/data/workers/llm.shared-worker';
import { configureModelEnvironment } from '@/layers/data/workers/model-environment';
import { TokenizerUtility } from '@/layers/shared/utils/tokenizer';

const handler = createLlmMessageHandler({
  publish: (message) => globalThis.postMessage(message),
  loadGeneratorPipeline: async (config, progress) => {
    configureModelEnvironment(config);
    return await pipeline('text-generation', config.model, {
      device: config.device,
      dtype: config.dtype,
      progress_callback: progress,
    });
  },
  loadTokenizer: async (model) => {
    const tokenizer = new TokenizerUtility(model);
    await tokenizer.initTokenizer();
    return tokenizer;
  },
});
globalThis.addEventListener('message', (event) => {
  void handler(event);
});
