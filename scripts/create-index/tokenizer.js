import { AutoTokenizer } from '@huggingface/transformers';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
export class ChunkTextByToken {
  tokenizer;
  model_id;
  constructor(model_id) {
    this.model_id = model_id;
  }

  initAutoTokenizer = async () => {
    this.tokenizer = await AutoTokenizer.from_pretrained(this.model_id);
  };

  tagContent = (array, text) => `${array.join(' ')} ${text}`;

  #isShortIntermediateChunk = (chunkIds, minTokens, end, totalTokens, start) =>
    chunkIds.length < minTokens && end !== totalTokens && start !== 0;

  // https://docs.langchain.com/oss/javascript/integrations/splitters/code_splitter
  createChunksRecursiveTextSplitterAsync = async (
    text,
    index,
    { maxChars = 200, overlap = 40 } = {},
  ) => {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: maxChars,
      chunkOverlap: overlap,
    });

    const textChunks = await splitter.splitText(text);
    return textChunks.map((chunk) => ({
      text: chunk,
      index,
    }));
  };

  createChunksAsync = async (
    text,
    index,
    { minTokens = 100, maxTokens = 200, overlap = 40, tags = [] } = {},
  ) => {
    const tokenIds = this.tokenizer.encode(text);
    const chunks = [];
    try {
      this.#populateChunks(tokenIds, index, chunks, { minTokens, maxTokens, overlap, tags });
    } catch (error) {
      console.error('[ERROR] - Failed to tokenize content', error);
    }
    return chunks;
  };

  #populateChunks(tokenIds, index, chunks, { minTokens, maxTokens, overlap, tags }) {
    let start = 0;
    while (start < tokenIds.length) {
      const end = start + maxTokens;
      const chunkIds = tokenIds.slice(start, end);
      if (this.#isShortIntermediateChunk(chunkIds, minTokens, end, tokenIds.length, start)) break;
      const chunkText = this.tokenizer.decode(chunkIds);
      chunks.push({ text: this.tagContent(tags, chunkText), tokenCount: chunkIds.length, index });
      start = end - overlap;
    }
  }
}
