import {
  type Chat,
  type Message,
  type StoppingCriteria,
  type TextGenerationConfig,
  type TextGenerationOutput,
  type TextGenerationPipeline,
  type TextGenerationSingle,
  TextStreamer,
} from '@huggingface/transformers';

import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type TokenizerUtility } from '@/layers/shared/utils/tokenizer';

export class LocalLLMData {
  constructor(
    private readonly generator: TextGenerationPipeline,
    private readonly tokenizerUtility: TokenizerUtility,
    private readonly modelMaxTokens = 0,
    private readonly options: Partial<TextGenerationConfig>,
  ) {}

  chatWithModel = async (
    prompt: Chat,
    generator: TextGenerationPipeline,
    options: Partial<TextGenerationConfig> & { stopping_criteria?: StoppingCriteria | undefined },
  ): Promise<TextGenerationOutput | TextGenerationOutput[]> => await generator(prompt, options);

  getTextStreamer = (
    generator: TextGenerationPipeline,
    callback: (txt: string) => void,
  ): TextStreamer =>
    new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: callback,
    });

  isChatMessage = (message: unknown): message is Message =>
    message && typeof message === 'object' && 'content' in message && 'role' in message
      ? true
      : false;

  readonly chatMessageHandler = async (
    chatMessages: Chat,
    callback: (txt: string) => void,
    stoppingCriteria?: StoppingCriteria,
    generation: Partial<TextGenerationConfig> = this.options,
  ): Promise<TextGenerationSingle | undefined> => {
    if (!this.guardChatMessageHandler(chatMessages)) return;

    const lastMessage = chatMessages.at(-1);
    if (!lastMessage) return;

    const tokenTotal = this.tokenizerUtility.countTokens(lastMessage.content);

    if (tokenTotal > this.modelMaxTokens) {
      console.error(
        `[${SeverityLevelCodes.ERROR}] - TO many tokens in query! Total amount of tokens: ${tokenTotal}`,
      );
    }

    const output = await this.chatWithModel(chatMessages, this.generator, {
      ...generation,
      streamer: this.getTextStreamer(this.generator, callback),
      stopping_criteria: stoppingCriteria,
    });

    if (!output[0] || !('generated_text' in output[0])) {
      return;
    }
    return output[0];
  };
  private readonly guardChatMessageHandler = (chatMessages: Chat): boolean => {
    if (!Array.isArray(chatMessages) || chatMessages.length <= 1) return false;
    const last = chatMessages.at(-1);
    return this.isChatMessage(last) && last.role !== 'system' && last.role !== 'assistant';
  };
}
