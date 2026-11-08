import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OnlineChatClient } from '@/layers/data/online-chat.client';
import { OnlineModelRepository } from '@/layers/data/online-model-repository.data';

test('model discovery and generation use the same configured API directory', async () => {
  const base = 'https://example.test/assistant/v2/';
  const model = {
    id: 'gpt-6-luna',
    label: 'GPT-6 Luna',
    reasoningEffort: 'low',
    maxOutputTokens: 256,
  };
  const repository = new OnlineModelRepository(base, async (url) => {
    assert.equal(url, 'https://example.test/assistant/v2/models');
    return Response.json({ models: [model] });
  });
  const [choice] = await repository.load();
  const client = new OnlineChatClient(
    base,
    { model: choice.id, maxOutputTokens: choice.maxOutputTokens },
    async (url) => {
      assert.equal(url, 'https://example.test/assistant/v2/generate');
      return new Response('{"type":"delta","text":"Configured API"}\n{"type":"done"}\n');
    },
  );
  const answer = await client.generate([{ role: 'user', content: 'Hello' }], () => {}, 'request');
  assert.equal(answer, 'Configured API');
});

test('online generation streams output and omits browser system instructions', async () => {
  let body;
  const generation = new OnlineChatClient(
    'https://example.test/api/',
    { model: 'gpt-6-luna', maxOutputTokens: 512 },
    async (url, options) => {
      assert.equal(url, 'https://example.test/api/generate');
      body = JSON.parse(options.body);
      return new Response('{"type":"delta","text":"Hi"}\n{"type":"done"}\n');
    },
  );
  const chunks = [];
  const result = await generation.generate(
    [
      { role: 'system', content: 'Untrusted instructions' },
      { role: 'user', content: 'CONTEXT: CV QUESTION: Hello' },
    ],
    (text) => chunks.push(text),
    'request',
  );
  assert.deepEqual(chunks, ['Hi']);
  assert.equal(result, 'Hi');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'CONTEXT: CV QUESTION: Hello' }]);
  assert.equal(body.maxOutputTokens, 512);
});

test('split UTF-8 and JSON chunks preserve text exactly', async () => {
  const bytes = new TextEncoder().encode('{"type":"delta","text":"Résumé"}\n{"type":"done"}\n');
  const generation = new OnlineChatClient(
    '/api/',
    { model: 'gpt-6-luna', maxOutputTokens: 256 },
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
            controller.close();
          },
        }),
      ),
  );
  const streamed = [];
  const result = await generation.generate(
    [{ role: 'user', content: 'Hello' }],
    (text) => streamed.push(text),
    'request',
  );
  assert.equal(result, 'Résumé');
  assert.deepEqual(streamed, ['Résumé']);
});

test('truncated and failed streams retain chunks but cannot report completion', async () => {
  for (const tail of ['', '{"type":"error","error":"private"}\n', '{"type":"done"}']) {
    const generation = new OnlineChatClient(
      '/api/',
      { model: 'gpt-6-luna', maxOutputTokens: 256 },
      async () => new Response(`{"type":"delta","text":"Partial"}\n${tail}`),
    );
    const chunks = [];
    await assert.rejects(
      generation.generate(
        [{ role: 'user', content: 'Hello' }],
        (text) => chunks.push(text),
        'request',
      ),
    );
    assert.deepEqual(chunks, ['Partial']);
  }
});

test('cancelling the browser client aborts HTTP and suppresses late completion without replay', async () => {
  let signal;
  let requests = 0;
  let streamed;
  const firstChunk = new Promise((resolve) => {
    streamed = resolve;
  });
  const client = new OnlineChatClient(
    '/api/',
    { model: 'gpt-6-luna', maxOutputTokens: 256 },
    async (_url, options) => {
      requests++;
      signal = options.signal;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"type":"delta","text":"Partial"}\n'));
            signal.addEventListener('abort', () => controller.error(new Error('Aborted')));
          },
        }),
      );
    },
  );
  const chunks = [];
  const result = client.generate(
    [{ role: 'user', content: 'Hello' }],
    (text) => {
      chunks.push(text);
      streamed();
    },
    'request',
  );
  await firstChunk;
  client.cancel('request');
  await assert.rejects(result, /Aborted/);
  assert.equal(signal.aborted, true);
  assert.equal(requests, 1);
  assert.deepEqual(chunks, ['Partial']);
  client.dispose();
});

test('cancellation also stops events already buffered in an HTTP response', async () => {
  const client = new OnlineChatClient(
    '/api/',
    { model: 'gpt-6-luna', maxOutputTokens: 256 },
    async () =>
      new Response(
        '{"type":"delta","text":"First"}\n{"type":"delta","text":"Late"}\n{"type":"done"}\n',
      ),
  );
  const chunks = [];
  const result = client.generate(
    [],
    (text) => {
      chunks.push(text);
      client.cancel('request');
    },
    'request',
  );
  await assert.rejects(result, { name: 'AbortError' });
  assert.deepEqual(chunks, ['First']);
  client.dispose();
});
