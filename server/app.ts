import { once } from 'node:events';

import express, { type Request, type Response } from 'express';

import { defaultModel, type GenerationProvider, type GenerationRequest, type OnlineModel } from './generation.ts';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const validMessage = (value: unknown): boolean => record(value) &&
  (value.role === 'user' || value.role === 'assistant') &&
  typeof value.content === 'string' && value.content.length > 0 && value.content.length <= 32_000;

const validMessages = (messages: unknown): boolean => {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) return false;
  const last: unknown = messages.at(-1);
  return messages.every((message: unknown) => validMessage(message)) && record(last) && last.role === 'user';
};
const validRequest = (body: unknown, model: OnlineModel): body is GenerationRequest =>
  record(body) && body.model === model.id &&
  Number.isInteger(body.maxOutputTokens) && typeof body.maxOutputTokens === 'number' &&
  body.maxOutputTokens >= 1 && body.maxOutputTokens <= model.maxOutputTokens && validMessages(body.messages);

const write = async (response: Response, value: unknown, signal: AbortSignal): Promise<void> => {
  signal.throwIfAborted();
  if (!response.write(`${JSON.stringify(value)}\n`)) await once(response, 'drain', { signal });
};

const generate = async (
  request: Request, response: Response,
  provider: GenerationProvider, model: OnlineModel,
): Promise<void> => {
  if (!validRequest(request.body, model)) {
    response.status(400).json({ error: 'Invalid generation request.' });
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Generation timed out.')), 120_000);
  const cancel = (): void => controller.abort(new Error('Client disconnected.'));
  response.once('close', cancel);
  response.type('application/x-ndjson').set('Cache-Control', 'no-store').set('X-Accel-Buffering', 'no');
  response.flushHeaders();
  try {
    for await (const text of provider.generate(request.body, controller.signal))
      await write(response, { type: 'delta', text }, controller.signal);
    await write(response, { type: 'done' }, controller.signal);
  } catch {
    if (!response.destroyed) response.write(`${JSON.stringify({ type: 'error', error: 'Online generation failed. Retry explicitly.' })}\n`);
  } finally {
    clearTimeout(timeout);
    response.off('close', cancel);
    response.end();
  }
};

export const createApp = (provider: GenerationProvider, model: OnlineModel = defaultModel): express.Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', express.json({ limit: '128kb' }));
  app.get('/api/models', (_request, response) => { response.json({ models: [model] }); });
  app.post('/api/generate', async (request, response) => { await generate(request, response, provider, model); });
  app.use('/api', (_request, response) => { response.status(404).json({ error: 'Unknown API route.' }); });
  app.use((_error: unknown, _request: Request, response: Response, _next: express.NextFunction) => {
    response.status(400).json({ error: 'Invalid JSON request or request too large.' });
  });
  return app;
};
