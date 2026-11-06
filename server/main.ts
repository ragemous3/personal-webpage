import path from 'node:path';

import express from 'express';
import OpenAI from 'openai';

import { createApp } from './app.ts';
import { defaultModel } from './generation.ts';
import { OpenAIProvider } from './openai-provider.ts';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('Set OPENAI_API_KEY in the server environment.');
const modelId = process.env.OPENAI_MODEL ?? defaultModel.id;
const model = { ...defaultModel, id: modelId, label: modelId };
const app = createApp(new OpenAIProvider(new OpenAI({ apiKey, maxRetries: 0, timeout: 110_000 })), model);
app.use(express.static(path.resolve('public')));
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.info(`Assistant API and built site listening on port ${port}`));
