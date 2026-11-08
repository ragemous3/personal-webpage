import { createLlmMessageHandler } from '@/layers/data/workers/llm-driver.factory';
import { SharedModelRuntime } from '@/layers/data/workers/shared-model-runtime.data';

const generator = async (_messages, options) => {
  options.streamer.callback_function('Controlled local response');
  return [{ generated_text: 'Controlled local response' }];
};
generator.tokenizer = {};
generator.dispose = async () => {};

const runtime = new SharedModelRuntime('llm', (publish) => {
  const handle = createLlmMessageHandler({
    loadGeneratorPipeline: async () => {
      await fetch('/__verify/events', { method: 'POST', body: JSON.stringify({ type: 'local-pipeline-loaded' }) });
      return generator;
    },
    loadTokenizer: async () => ({ getMaxLength: () => 2048, countTokens: () => 1 }),
    publish,
  });
  return { handle, dispose: handle.dispose };
});
globalThis.addEventListener('connect', ({ ports }) => runtime.connect(ports[0]));
