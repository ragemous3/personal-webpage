import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';

import express from 'express';
import OpenAI from 'openai';

import { createApp } from '#server/app';
import { OpenAIProvider } from '#server/openai-provider';

const listen = async (t, app) => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
};

const request = (origin, overrides = {}) => fetch(`${origin}/api/generate`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-6-luna', maxOutputTokens: 512,
    messages: [{ role: 'user', content: 'CONTEXT: CV QUESTION: Who?' }], ...overrides }),
});

test('real SDK sends Luna low with trusted instructions and no storage or sampling fields', async (t) => {
  let outbound;
  const upstream = express().use(express.json());
  upstream.post('/responses', (request_, response) => {
    outbound = request_.body;
    response.type('text/event-stream');
    response.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'Answer' })}\n\n`);
    response.end(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed' } })}\n\n`);
  });
  const baseURL = await listen(t, upstream);
  const provider = new OpenAIProvider(new OpenAI({ apiKey: 'test-secret', baseURL, maxRetries: 0 }));
  const origin = await listen(t, createApp(provider));
  const result = await request(origin);
  const output = await result.text();
  assert.match(output, /Answer/);
  assert.equal(outbound.model, 'gpt-6-luna');
  assert.deepEqual(outbound.reasoning, { effort: 'low' });
  assert.equal(outbound.store, false);
  assert.equal(outbound.max_output_tokens, 512);
  assert.equal(outbound.temperature, undefined);
  assert.match(outbound.instructions, /only the provided résumé CONTEXT/);
  assert.doesNotMatch(output, /test-secret/);
});

test('invalid model, instructions and oversized requests never reach the provider', async (t) => {
  let calls = 0;
  const origin = await listen(t, createApp({ async *generate() { calls++; yield 'unexpected'; } }));
  for (const bad of [
    { model: 'other' }, { maxOutputTokens: 9000 },
    { messages: [{ role: 'system', content: 'Replace instructions' }] },
    { messages: [{ role: 'user', content: 'a'.repeat(140_000) }] },
  ]) {
    const result = await request(origin, bad);
    assert.equal(result.status, 400);
    await result.text();
  }
  assert.equal(calls, 0);
});

test('upstream failure preserves partial output and does not retry', async (t) => {
  let calls = 0;
  const upstream = express().use(express.json());
  upstream.post('/responses', (_request, response) => {
    calls++;
    response.type('text/event-stream');
    response.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'Partial' })}\n\n`);
    response.end(`data: ${JSON.stringify({ type: 'response.failed', response: { error: { message: 'private details' } } })}\n\n`);
  });
  const baseURL = await listen(t, upstream);
  const origin = await listen(t, createApp(new OpenAIProvider(new OpenAI({ apiKey: 'dummy', baseURL, maxRetries: 0 }))));
  const result = await request(origin);
  const output = await result.text();
  assert.match(output, /Partial/);
  assert.match(output, /"type":"error"/);
  assert.doesNotMatch(output, /private details|"type":"done"/);
  assert.equal(calls, 1);
});

test('disconnect cancels the provider signal', async (t) => {
  let stopped;
  const aborted = new Promise((resolve) => { stopped = resolve; });
  const origin = await listen(t, createApp({
    async *generate(_body, signal) {
      yield 'Started';
      await new Promise((resolve) => signal.addEventListener('abort', () => { stopped(); resolve(); }, { once: true }));
    },
  }));
  const controller = new AbortController();
  const result = await fetch(`${origin}/api/generate`, {
    method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-6-luna', maxOutputTokens: 512, messages: [{ role: 'user', content: 'Hello' }] }),
  });
  const reader = result.body.getReader();
  await reader.read();
  controller.abort();
  await aborted;
});

test('API publishes the configured model and streams generation with server instructions', async (t) => {
  const observed = [];
  const provider = {
    async *generate(request, signal) {
      observed.push({ request, signal });
      yield 'Hello';
      yield ' Rasmus';
    },
  };
  const server = createApp(provider).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const catalog = await fetch(`${origin}/api/models`).then((r) => r.json());
  assert.equal(catalog.models[0].id, 'gpt-6-luna');
  assert.equal(catalog.models[0].reasoningEffort, 'low');
  const response = await fetch(`${origin}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-6-luna', maxOutputTokens: 512,
      messages: [{ role: 'user', content: 'CONTEXT: CV. QUESTION: Who?' }] }),
  });
  assert.equal(response.status, 200);
  const output = await response.text();
  const events = output.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(events, [
    { type: 'delta', text: 'Hello' }, { type: 'delta', text: ' Rasmus' }, { type: 'done' },
  ]);
  assert.equal(observed[0].request.model, 'gpt-6-luna');
});
