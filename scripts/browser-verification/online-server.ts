import express, { type Express } from 'express';
import OpenAI from 'openai';

import { createApp } from '#server/app';
import { OpenAIProvider } from '#server/openai-provider';

interface Evidence { events: unknown[] }

export const createControlledApi = (origin: string, evidence: Evidence): Express => {
  const app = createApp(new OpenAIProvider(new OpenAI({
    apiKey: 'verification-only', baseURL: `${origin}/__verify/openai`, maxRetries: 0,
  })));
  app.use('/__verify/openai', express.json());
  app.post('/__verify/openai/responses', (request, response) => {
    const body = request.body as { model: string; reasoning: unknown; input: Array<{ content: string }>; instructions: string };
    const question = body.input.at(-1)?.content ?? '';
    evidence.events.push({ type: 'online-request', model: body.model, reasoning: body.reasoning, question });
    response.type('text/event-stream');
    response.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: 'Controlled online response' })}\n\n`);
    const timer = setTimeout(() => {
      const type = question.includes('fail-online') ? 'response.failed' : 'response.completed';
      response.end(`data: ${JSON.stringify({ type, response: { status: 'completed' } })}\n\n`);
    }, question.includes('hold') ? 5000 : 200);
    response.once('close', () => {
      clearTimeout(timer);
      evidence.events.push({ type: 'online-closed' });
    });
  });
  return app;
};
