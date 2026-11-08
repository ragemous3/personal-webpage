import { type ProgressInfo, type TextGenerationPipeline } from '@huggingface/transformers';

import { type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type TokenizerUtility } from '@/layers/shared/utils/tokenizer';

export interface LlmWorkerDependencies {
  loadGeneratorPipeline: (
    config: LmConfig,
    progress: (value: ProgressInfo) => void,
  ) => Promise<TextGenerationPipeline>;
  loadTokenizer: (model: string, revision?: string) => Promise<TokenizerUtility>;
  publish: (message: unknown) => void;
}
