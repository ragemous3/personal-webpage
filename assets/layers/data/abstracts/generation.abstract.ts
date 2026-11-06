import { type Chat, type StoppingCriteria, type TextGenerationConfig, type TextGenerationSingle } from '@huggingface/transformers';

export abstract class GenerationAbstract {
  constructor(protected options: Partial<TextGenerationConfig>) {}

  configure = (options: Partial<TextGenerationConfig>): void => { this.options = options; };

  abstract chatMessageHandler(
    messages: Chat, callback: (text: string) => void,
    stopping?: StoppingCriteria, signal?: AbortSignal,
  ): Promise<TextGenerationSingle | undefined>;

  abstract dispose(): Promise<void>;
}
