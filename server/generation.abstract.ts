import { type GenerationRequest } from './generation.model.ts';

export abstract class GenerationProviderAbstract {
  abstract generate(request: GenerationRequest, signal: AbortSignal): AsyncIterable<string>;
}
