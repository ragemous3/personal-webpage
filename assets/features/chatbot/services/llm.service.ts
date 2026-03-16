import {
  Chat,
  pipeline,
  ProgressInfo,
  TextGenerationOutput,
  TextGenerationPipeline,
  TextGenerationSingle,
  TextStreamer,
} from '@huggingface/transformers';

import { SeverityLevelCodes } from '../../../shared/constants';
import { Nullable } from '../../../shared/models';
import { TokenizerUtil } from '../../../shared/utils';
import { Chunk, GenerationConfig } from '../models/models';

export class LocalLLMService {
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
    })) as TextGenerationPipeline;

  init = async (progressTracker: (progress: ProgressInfo) => void) => {
    const tokenizerUtil = new TokenizerUtil(this.llmModelName);
    await tokenizerUtil.initTokenizer();
    this.modelMaxTokens = tokenizerUtil.getMaxLength();

    await this.loadModel(this.llmModelName, progressTracker);
  };

  promptModel = async (
    prompt: string,
    generator: TextGenerationPipeline,
    options: Partial<GenerationConfig> = {
      max_new_tokens: 128,
      do_sample: false,
      return_full_text: false,
    },
  ): Promise<TextGenerationOutput | TextGenerationOutput[]> => await generator(prompt, options);

  reScore = async (context: Chunk[], query: string, generator: TextGenerationPipeline) => {
    const score = [];

    for (const ctx of context) {
      const prompt = `
  CONTEXT is text from a person named Rasmus resumé.
   Answer with only:
  1 = context answers the query
  0 = context does not answer the query
    QUERY:  ${query}\n
    CONTEXT: ${ctx.text}
  `;
      if (!this.tokenizerUtil) return;
      if (this.tokenizerUtil.countTokens(prompt) > this.modelMaxTokens) {
        console.error('removed matched data because it exceeded MODEL_MAX_TOKENS');
        continue;
      } else {
        const output = await this.promptModel(prompt, generator);
        const text = output[0].generated_text;

        score.push(text);
      }
      console.log(JSON.stringify(score));
      return context[
        score.reduce((acc, answer, index) => {
          const parsed = parseInt(answer);
          if (parsed > acc) {
            return parseInt(acc);
          }
          return acc;
        }, 0)
      ];
    }
  };

  getTxTPrompt = (context: Chunk[], query: string): string => `
You are answering questions about Rasmus resumé / CV.
You must answer the QUESTION using ONLY the information found in the CONTEXT section.
RULES:
- If the answer is not explicitly stated in the CONTEXT, respond exactly with:
  "I don't have enough information in the provided documents to answer that."
CONTEXT:
${context.map((chunk) => chunk.text).join('\n')}
QUESTION:
${query}
`;

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
      skip_special_tokens: true,
      callback_function: cb,
    });

  guardResponse = (
    output: TextGenerationOutput | TextGenerationOutput[],
  ): TextGenerationSingle | undefined => {
    if (!(Array.isArray(output) && !output.length) || !Array.isArray(output) || !output[0]) {
      console.error('Expected output to be an array!');
      return;
    }

    if (!('generated_text' in output[0])) {
      return;
    }

    return output[0];
  };

  chatWithBot = async (
    chatMessages: Chat,
    cb: (txt: string) => Promise<void>,
  ): Promise<Nullable<TextGenerationSingle>> => {
    if (!this.generator) return null;

    const streamer = this.getTextStreamer(this.generator, cb);
    // prompt = await reScore(context, query, generator);
    let prompt = this.getChatPrompt(chatMessages);

    if (!prompt) return null;
    if (!this.tokenizerUtil) {
      console.error('TokenizerUtil is undefined, perhaps you forgot to init?');
      return null;
    }

    const tokenTotal = this.tokenizerUtil.countTokens(prompt);
    if (tokenTotal > this.modelMaxTokens) {
      console.error(
        `[${SeverityLevelCodes}] - TO many tokens in query! Total amount of tokens: ${tokenTotal}`,
      );
    }

    const output = await this.promptModel(prompt, this.generator, {
      streamer,
      max_new_tokens: 100,
      temperature: 0.75,
    });

    const botResp: TextGenerationSingle | undefined = this.guardResponse(output);

    if (botResp) {
      return botResp;
    }
    return null;
  };
}
