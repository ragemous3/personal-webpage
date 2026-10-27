import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLlmMessageHandler } from '@/layers/data/workers/llm.worker';

const config = {
  source: '/workers/llm.js',
  model: 'test-model',
  device: 'cpu',
  dtype: 'fp32',
  generation: { max_new_tokens: 32 },
};

const emptyGenerator = async () => [];
emptyGenerator.tokenizer = {};

const failingGenerator = async () => {
  throw new Error('generation failed');
};
failingGenerator.tokenizer = {};

test('initialization loads the configured model and tokenizer before reporting ready', async () => {
  const calls = [];
  const messages = [];
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: async (settings, progress) => {
      calls.push(['pipeline', settings]);
      progress({ status: 'progress' });
      return emptyGenerator;
    },
    loadTokenizer: async (model) => {
      calls.push(['tokenizer', model]);
      return { getMaxLength: () => 2048, countTokens: () => 1 };
    },
    publish: (message) => messages.push(message),
  });

  await handler({ data: { id: 'init-1', name: 'llm', task: 'llm:init', payload: config } });

  assert.deepEqual(calls, [
    ['pipeline', config],
    ['tokenizer', 'test-model'],
  ]);
  assert.deepEqual(
    messages.map(({ id, task }) => ({ id, task })),
    [
      { id: 'init-1', task: 'llm:progress' },
      { id: 'init-1', task: 'llm:ready' },
    ],
  );
});

test('a query before initialization returns an error for that request', async () => {
  const messages = [];
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: async () => assert.fail('model must not load'),
    loadTokenizer: async () => assert.fail('tokenizer must not load'),
    publish: (message) => messages.push(message),
  });

  await handler({
    data: { id: 'query-1', name: 'llm', task: 'llm:query', payload: { message: [] } },
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, 'query-1');
  assert.equal(messages[0].task, 'llm:query');
  assert.match(messages[0].error.message, /not ready/);
});

test('failed initialization reports the error and can be retried', async () => {
  const messages = [];
  let attempts = 0;
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('model download failed');
      return emptyGenerator;
    },
    loadTokenizer: async () => ({ getMaxLength: () => 2048, countTokens: () => 1 }),
    publish: (message) => messages.push(message),
  });

  await handler({ data: { id: 'init-1', name: 'llm', task: 'llm:init', payload: config } });
  await handler({ data: { id: 'init-2', name: 'llm', task: 'llm:init', payload: config } });

  assert.equal(attempts, 2);
  assert.deepEqual(
    messages.map(({ id, task }) => ({ id, task })),
    [
      { id: 'init-1', task: 'llm:init' },
      { id: 'init-2', task: 'llm:ready' },
    ],
  );
  assert.match(messages[0].error.message, /model download failed/);
});

test('tokenizer failure cannot report readiness and a later initialization can succeed', async () => {
  const messages = [];
  let attempts = 0;
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: async () => emptyGenerator,
    loadTokenizer: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('tokenizer unavailable');
      return { getMaxLength: () => 2048, countTokens: () => 1 };
    },
    publish: (message) => messages.push(message),
  });

  await handler({ data: { id: 'init-1', name: 'llm', task: 'llm:init', payload: config } });
  await handler({ data: { id: 'init-2', name: 'llm', task: 'llm:init', payload: config } });

  assert.equal(attempts, 2);
  assert.deepEqual(
    messages.map(({ id, task }) => ({ id, task })),
    [
      { id: 'init-1', task: 'llm:init' },
      { id: 'init-2', task: 'llm:ready' },
    ],
  );
  assert.match(messages[0].error.message, /tokenizer unavailable/);
});

test('concurrent initialization shares one load and answers both requests when ready', async () => {
  const messages = [];
  let finishLoading;
  let loads = 0;
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: () => {
      loads += 1;
      return new Promise((resolve) => {
        finishLoading = () => resolve(emptyGenerator);
      });
    },
    loadTokenizer: async () => ({ getMaxLength: () => 2048, countTokens: () => 1 }),
    publish: (message) => messages.push(message),
  });

  const first = handler({ data: { id: 'init-1', name: 'llm', task: 'llm:init', payload: config } });
  const second = handler({
    data: { id: 'init-2', name: 'llm', task: 'llm:init', payload: config },
  });
  assert.equal(loads, 1);
  assert.equal(messages.length, 0);
  finishLoading();
  await Promise.all([first, second]);

  assert.deepEqual(
    messages.map(({ id, task }) => ({ id, task })),
    [
      { id: 'init-1', task: 'llm:ready' },
      { id: 'init-2', task: 'llm:ready' },
    ],
  );
});

test('conflicting initialization is rejected during loading and after readiness', async () => {
  const messages = [];
  let finishLoading;
  let loads = 0;
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: () => {
      loads += 1;
      return new Promise((resolve) => {
        finishLoading = () => resolve(emptyGenerator);
      });
    },
    loadTokenizer: async () => ({ getMaxLength: () => 2048, countTokens: () => 1 }),
    publish: (message) => messages.push(message),
  });
  const otherConfig = { ...config, model: 'different-model' };

  const first = handler({ data: { id: 'init-1', name: 'llm', task: 'llm:init', payload: config } });
  const conflicting = handler({
    data: { id: 'init-2', name: 'llm', task: 'llm:init', payload: otherConfig },
  });
  finishLoading();
  await Promise.all([first, conflicting]);
  await handler({ data: { id: 'init-3', name: 'llm', task: 'llm:init', payload: otherConfig } });

  assert.equal(loads, 1);
  assert.deepEqual(
    messages.map(({ id, task }) => ({ id, task })),
    [
      { id: 'init-2', task: 'llm:init' },
      { id: 'init-1', task: 'llm:ready' },
      { id: 'init-3', task: 'llm:init' },
    ],
  );
  assert.match(messages[0].error.message, /different configuration/);
  assert.match(messages[2].error.message, /different configuration/);
});

test('a successful query streams and returns the model response with its request ID', async () => {
  const messages = [];
  const answer = { generated_text: 'Hello' };
  const generator = async (prompt, options) => {
    assert.deepEqual(prompt, [
      { role: 'system', content: 'Answer from the résumé.' },
      { role: 'user', content: 'Who is Rasmus?' },
    ]);
    assert.equal(options.max_new_tokens, 32);
    options.streamer.on_finalized_text('Hello', false);
    return [answer];
  };
  generator.tokenizer = {};
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: async () => generator,
    loadTokenizer: async () => ({ getMaxLength: () => 2048, countTokens: () => 4 }),
    publish: (message) => messages.push(message),
  });
  await handler({ data: { id: 'init-1', name: 'llm', task: 'llm:init', payload: config } });
  await handler({
    data: {
      id: 'query-2',
      name: 'llm',
      task: 'llm:query',
      payload: {
        message: [
          { role: 'system', content: 'Answer from the résumé.' },
          { role: 'user', content: 'Who is Rasmus?' },
        ],
      },
    },
  });

  assert.deepEqual(messages.slice(1), [
    { id: 'query-2', name: 'llm', task: 'llm:stream:response', payload: 'Hello' },
    { id: 'query-2', name: 'llm', task: 'llm:message:response', payload: answer },
  ]);
});

test('an asynchronous query failure reports an error for the query', async () => {
  const messages = [];
  const handler = createLlmMessageHandler({
    loadGeneratorPipeline: async () => failingGenerator,
    loadTokenizer: async () => ({ getMaxLength: () => 2048, countTokens: () => 4 }),
    publish: (message) => messages.push(message),
  });
  await handler({ data: { id: 'init-1', name: 'llm', task: 'llm:init', payload: config } });
  await handler({
    data: {
      id: 'query-3',
      name: 'llm',
      task: 'llm:query',
      payload: {
        message: [
          { role: 'system', content: 'Answer from the résumé.' },
          { role: 'user', content: 'Who is Rasmus?' },
        ],
      },
    },
  });

  assert.equal(messages.length, 2);
  assert.equal(messages[1].id, 'query-3');
  assert.equal(messages[1].task, 'llm:query');
  assert.match(messages[1].error.message, /generation failed/);
});
