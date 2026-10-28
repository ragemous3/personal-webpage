import { type ContentRepositoryContract } from '@/layers/shared/contracts/content-repository.contract';
import { isRecord } from '@/layers/shared/guards/guards';

import { ApiBase } from './abstracts/base.infra';
import { type Chunk } from './models/models';

const parseChunks = (value: unknown): Chunk[] => {
  if (!Array.isArray(value)) throw new Error('Expected résumé chunks');
  return value.map((chunk: unknown): Chunk => {
    if (!isRecord(chunk) || typeof chunk.text !== 'string' || typeof chunk.index !== 'number') {
      throw new Error('Invalid résumé chunk');
    }
    return { text: chunk.text, index: chunk.index };
  });
};

export class ContentRepository extends ApiBase implements ContentRepositoryContract {
  #chunks: Chunk[] = []; //TODO: maybe remove?

  getChunksAsync = async (path: string): Promise<Chunk[]> => {
    this.#chunks = await this.loadJSON(path, parseChunks);
    return [...this.#chunks];
  };

  getCachedChunksSync = (): Chunk[] => [...this.#chunks];
}
