import { env } from '@huggingface/transformers';

import { type InitConfigBase } from '@/layers/data/models/chatbot-config.model';

export const configureModelEnvironment = (config: InitConfigBase): void => {
  env.useBrowserCache = true;
  const wasm = env.backends.onnx.wasm;
  if (!wasm) throw new Error('ONNX WASM backend is unavailable');
  wasm.numThreads = 1;
  if (config.modelBaseUrl) {
    env.allowLocalModels = false;
    env.remoteHost = config.modelBaseUrl.endsWith('/')
      ? config.modelBaseUrl
      : `${config.modelBaseUrl}/`;
  }
  if (config.wasmBaseUrl) wasm.wasmPaths = config.wasmBaseUrl;
};
