import { AutoTokenizer, type PreTrainedTokenizer } from '@huggingface/transformers';

import { SeverityLevelCodes } from '@/layers/shared/constants';
import { isNumber } from '@/layers/shared/guards/guards';

export class TokenizerUtility {
  tokenizer: PreTrainedTokenizer | undefined;
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  initTokenizer = async (): Promise<PreTrainedTokenizer> =>
    (this.tokenizer = await AutoTokenizer.from_pretrained(this.model));

  getMaxLength = (): number => {
    if (!this.tokenizer) throw new Error(`[${SeverityLevelCodes.ERROR}] - tokenizer not init`);
    if (!isNumber(this.tokenizer.model_max_length))
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - expected number of tokenizer model max length`,
      );
    return this.tokenizer.model_max_length;
  };

  countTokens = (text: string): number => {
    if (!this.tokenizer) throw new Error(`[${SeverityLevelCodes.ERROR}] - tokenizer not init`);
    const encoded = this.tokenizer.encode(text);
    return encoded.length;
  };
}
