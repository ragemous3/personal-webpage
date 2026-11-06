import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OnlineGeneration } from '@/layers/data/online-generation.data';

test('online generation streams output and omits browser system instructions', async () => {
  let body;
  const generation = new OnlineGeneration('gpt-6-luna', { max_new_tokens: 512 }, async (_url, options) => {
    body = JSON.parse(options.body);
    return new Response('{"type":"delta","text":"Hi"}\n{"type":"done"}\n');
  });
  const chunks = [];
  const result = await generation.chatMessageHandler([
    { role: 'system', content: 'Untrusted instructions' },
    { role: 'user', content: 'CONTEXT: CV QUESTION: Hello' },
  ], (text) => chunks.push(text));
  assert.deepEqual(chunks, ['Hi']);
  assert.deepEqual(result, { generated_text: 'Hi' });
  assert.deepEqual(body.messages, [{ role: 'user', content: 'CONTEXT: CV QUESTION: Hello' }]);
  assert.equal(body.maxOutputTokens, 512);
});

test('split UTF-8 and JSON chunks preserve text exactly', async () => {
  const bytes = new TextEncoder().encode('{"type":"delta","text":"Résumé"}\n{"type":"done"}\n');
  const generation = new OnlineGeneration('gpt-6-luna', {}, async () => new Response(new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      controller.close();
    },
  })));
  const streamed = [];
  const result = await generation.chatMessageHandler([{ role: 'user', content: 'Hello' }], (text) => streamed.push(text));
  assert.equal(result.generated_text, 'Résumé');
  assert.deepEqual(streamed, ['Résumé']);
});

test('truncated and failed streams retain chunks but cannot report completion', async () => {
  for (const tail of ['', '{"type":"error","error":"private"}\n', '{"type":"done"}']) {
    const generation = new OnlineGeneration('gpt-6-luna', {}, async () => new Response(`{"type":"delta","text":"Partial"}\n${tail}`));
    const chunks = [];
    await assert.rejects(generation.chatMessageHandler([{ role: 'user', content: 'Hello' }], (text) => chunks.push(text)));
    assert.deepEqual(chunks, ['Partial']);
  }
});
