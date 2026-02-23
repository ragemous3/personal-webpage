import { AutoTokenizer } from '@xenova/transformers';
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

  tagContent = (arr, text) => arr.join(' ') + ' ' + text;

  // https://docs.langchain.com/oss/javascript/integrations/splitters/code_splitter
  createChunksRecursiveTextSplitterAsync = async (
    text,
    index,
    { minChars = 100, maxChars = 200, overlap = 40, tags = [] } = {},
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
    let start = 0;
    try {
      while (start < tokenIds.length) {
        let end = start + maxTokens;
        const chunkIds = tokenIds.slice(start, end);

        // If this is not the first chunk and it's too small,
        // only allow it if it's the final chunk (completeness).
        if (
          chunkIds.length < minTokens &&
          end !== tokenIds.length &&
          start !== 0
        ) {
          break;
        }

        const chunkText = this.tokenizer.decode(chunkIds);
        chunks.push({
          text: this.tagContent(tags, chunkText),
          tokenCount: chunkIds.length,
          index,
        });

        // Move start forward with overlap
        start = end - overlap;
      }
    } catch (e) {
      console.error(e);
    }
    return chunks;
  };
}
