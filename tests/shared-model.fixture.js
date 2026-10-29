const active = new Map();
globalThis.addEventListener('message', ({ data: message }) => {
  if (message.task.endsWith(':init')) {
    if (message.payload.device === 'webgpu') {
      globalThis.postMessage({ ...message, error: { message: 'GPU unavailable' } });
      return;
    }
    globalThis.postMessage({ ...message, task: message.task.replace(':init', ':ready') });
    return;
  }
  if (message.task === 'vectordb:query') {
    setTimeout(() => globalThis.postMessage({ ...message, task: 'vectordb:query:response', payload: { response: { neighbors: [0] } } }), 10);
  }
  if (message.task === 'llm:cancel') {
    clearTimeout(active.get(message.requestId));
    setTimeout(() => globalThis.postMessage({ ...message, task: 'llm:cancel:response' }), 40);
  }
  if (message.task === 'llm:query') {
    if (message.payload.message.at(-1).content.includes('Crash worker')) throw new Error('Intentional model failure');
    active.set(message.requestId, setTimeout(() => globalThis.postMessage({ ...message, task: 'llm:message:response',
      payload: { generated_text: `Answer with budget ${message.payload.generation.max_new_tokens}` } }), 300));
  }
});
