import type OpenAI from 'openai';

import { GenerationProviderAbstract } from './generation.abstract.ts';
import { assistantInstructions, type GenerationRequest } from './generation.model.ts';

export class OpenAIProvider extends GenerationProviderAbstract {
  constructor(private readonly client: OpenAI) { super(); }

  async *generate(request: GenerationRequest, signal: AbortSignal): AsyncIterable<string> {
    const stream = await this.client.responses.create({
      model: request.model,
      instructions: assistantInstructions,
      input: request.messages,
      reasoning: { effort: 'low' },
      max_output_tokens: request.maxOutputTokens,
      store: false,
      stream: true,
    }, { signal });
    let completed = false;
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') yield event.delta;
      if (event.type === 'response.completed') completed = true;
      if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error')
        throw new Error('OpenAI could not complete the response. Retry explicitly.');
    }
    if (!completed) throw new Error('OpenAI stream ended before completion.');
  }
}
