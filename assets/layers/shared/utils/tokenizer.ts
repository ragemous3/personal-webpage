import { PreTrainedTokenizer, AutoTokenizer } from '@huggingface/transformers';

export class TokenizerUtil {
  tokenizer: PreTrainedTokenizer;
  model: string;

  constructor(model: string) {
    this.model = model;
  }

  initTokenizer = async (): Promise<PreTrainedTokenizer> =>
    (this.tokenizer = await AutoTokenizer.from_pretrained(this.model));

  getMaxLength = () => this.tokenizer.model_max_length;

  countTokens = (text: string): number => {
    const encoded = this.tokenizer.encode(text);
    return encoded.length;
  };
}
