import {
  Chat,
  Message,
  pipeline,
  ProgressInfo,
  TextGenerationOutput,
  TextGenerationPipeline,
  TextGenerationSingle,
  TextStreamer,
} from '@huggingface/transformers';

import { GenerationConfig } from './models/models';
import { SeverityLevelCodes } from '../shared/constants';
import { TokenizerUtil } from '../shared/utils/tokenizer';

export class LocalLLMData {
  modelMaxTokens: number = 0;
  llmModelName: string = 'Xenova/Qwen1.5-0.5B-Chat';
  tokenizerUtil: TokenizerUtil | undefined;
  generator: TextGenerationPipeline | undefined;

  loadModel = async (
    modelName: string = this.llmModelName,
    progressTracker: (progress: ProgressInfo) => void,
  ): Promise<TextGenerationPipeline> =>
    (this.generator = await pipeline('text-generation', modelName, {
      device: 'webgpu',
      dtype: 'q4',
      progress_callback: progressTracker,
    })) as unknown as TextGenerationPipeline;

  init = async (progressTracker: (progress: ProgressInfo) => void) => {
    this.tokenizerUtil = new TokenizerUtil(this.llmModelName);
    await this.tokenizerUtil.initTokenizer();
    this.modelMaxTokens = this.tokenizerUtil.getMaxLength();

    await this.loadModel(this.llmModelName, progressTracker);
  };

  chatWithModel = async (
    prompt: Chat,
    generator: TextGenerationPipeline,
    options: Partial<GenerationConfig> = {
      max_new_tokens: 128,
      do_sample: false,
      return_full_text: false,
    },
  ): Promise<TextGenerationOutput | TextGenerationOutput[]> => await generator(prompt, options);

  getChatPrompt = (chatMessages: Chat): undefined | string => {
    if (!this.tokenizerUtil) {
      console.error('TokenizerUtil is undefined, perhaps you forgot to init?');
      return;
    }

    const txt: unknown = this.tokenizerUtil.tokenizer.apply_chat_template(chatMessages, {
      tokenize: false,
    });
    if (typeof txt === 'string') return txt;
    console.error('Expected value to be string');
  };

  getTextStreamer = (generator: TextGenerationPipeline, cb: (txt: string) => void) =>
    new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: cb,
    });

  isChatMessage = (msg: Message | unknown): msg is Message =>
    msg && typeof msg === 'object' && 'content' in msg && 'role' in msg ? true : false;

  chatMessageHandler = async (
    chatMessages: Chat,
    cb: (txt: string) => void,
  ): Promise<TextGenerationSingle | undefined> => {
    if (
      !this.generator ||
      !chatMessages ||
      !Array.isArray(chatMessages) ||
      chatMessages.length <= 1 ||
      !chatMessages[chatMessages.length - 1]
    ) {
      return;
    }

    if (!this.tokenizerUtil) {
      console.error('TokenizerUtil is undefined, perhaps you forgot to init?');
      return;
    }
    const lastMsg = chatMessages[chatMessages.length - 1];

    if (!this.isChatMessage(lastMsg) || lastMsg.role === 'system' || lastMsg.role === 'assistant') {
      console.error(`[${SeverityLevelCodes.ERROR}] - Expected a chatMessages`);
      return;
    }

    const tokenTotal = this.tokenizerUtil.countTokens(lastMsg.content);

    if (tokenTotal > this.modelMaxTokens) {
      console.error(
        `[${SeverityLevelCodes}] - TO many tokens in query! Total amount of tokens: ${tokenTotal}`,
      );
    }

    const output = await this.chatWithModel(chatMessages, this.generator, {
      streamer: this.getTextStreamer(this.generator, cb),
      max_new_tokens: 100,
      temperature: 0.75,
    });

    if (!output || !output[0] || !('generated_text' in output[0])) {
      return;
    }
    return output[0];
  };
}
