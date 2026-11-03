const waitFor = async (condition, timeout = 600_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = condition();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Model benchmark observation deadline exceeded');
};
const configuration = () => ({
  source: '/__verify/baseline.js',
  model: 'Xenova/Qwen1.5-0.5B-Chat',
  device: 'wasm',
  dtype: 'q4',
  generation: { max_new_tokens: 32, do_sample: false },
  modelBaseUrl: `${globalThis.location.origin}/models/`,
  wasmBaseUrl: `${globalThis.location.origin}/lib/`,
});
const payload = {
  message: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Count from one to twenty.' },
  ],
};
globalThis.runBenchmark = async (kind) => {
  const response = await fetch('/data/workers.json');
  const { workers } = await response.json();
  const worker =
    kind === 'shared'
      ? new globalThis.SharedWorker(workers['llm.shared-worker.ts'], {
          type: 'module',
          name: 'Runtime-llm',
        })
      : new globalThis.Worker('/__verify/baseline.js', { type: 'module' });
  const port = kind === 'shared' ? worker.port : worker;
  const events = [];
  const id = crypto.randomUUID();
  const runtimeEpoch = crypto.randomUUID();
  const send = (task, body, requestId) =>
    port.postMessage({
      id,
      name: 'llm',
      runtimeEpoch,
      task,
      payload: body,
      ...(requestId ? { requestId } : {}),
    });
  port.addEventListener('message', ({ data }) => events.push({ data, at: performance.now() }));
  if (kind === 'shared') {
    port.start();
    await waitFor(() => events.find(({ data }) => data.task === 'runtime:state'));
    send('runtime:bind', null);
    await waitFor(() => events.find(({ data }) => data.task === 'runtime:bound'));
  }
  send('llm:init', configuration());
  await waitFor(() => events.find(({ data }) => data.task === 'llm:ready' || data.error));
  const failure = events.find(({ data }) => data.error);
  if (failure) throw new Error(failure.data.error.message);
  const samples = [];
  for (let index = 0; index < 4; index++) {
    const requestId = `sample-${index}`;
    const start = performance.now();
    send('llm:query', payload, requestId);
    const result = await waitFor(() =>
      events.find(
        ({ data }) => data.task === 'llm:message:response' && data.requestId === requestId,
      ),
    );
    const first = events.find(
      ({ data }) => data.task === 'llm:stream:response' && data.requestId === requestId,
    );
    samples.push({
      warmup: index === 0,
      elapsedMs: result.at - start,
      firstChunkMs: first.at - start,
      answer: result.data.payload.generated_text,
    });
  }
  let cancellation;
  if (kind === 'shared') {
    send('llm:query', payload, 'cancel-real');
    await waitFor(() =>
      events.find(
        ({ data }) => data.task === 'llm:stream:response' && data.requestId === 'cancel-real',
      ),
    );
    const start = performance.now();
    send('llm:cancel', {}, 'cancel-real');
    const stopped = await waitFor(
      () =>
        events.find(({ data }) => data.task === 'llm:stopped' && data.requestId === 'cancel-real'),
      30_000,
    );
    cancellation = { stopMs: stopped.at - start };
    send('runtime:dispose', null);
    await waitFor(() => events.find(({ data }) => data.task === 'runtime:disposed'));
    port.close();
  } else worker.terminate();
  return { kind, configuration: configuration(), samples, cancellation };
};
