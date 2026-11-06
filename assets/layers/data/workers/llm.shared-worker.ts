import { createLlmDriver } from './llm-driver.data';
import { SharedModelRuntime } from './shared-model-runtime.data';

export { createLlmDriver, createLlmMessageHandler } from './llm-driver.data';

if ('onconnect' in globalThis) {
  const runtime = new SharedModelRuntime('llm', createLlmDriver);
  globalThis.addEventListener('connect', (event: Event) => {
    const port = (event as MessageEvent).ports[0];
    if (port) runtime.connect(port);
  });
}
