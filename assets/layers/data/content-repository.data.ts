import { ContentRepositoryContract } from '../shared/contracts/content-repository.contract';
import { ApiBase } from './abstracts/base.infra';
import { Chunk } from './models/models';

export class ContentRepository extends ApiBase implements ContentRepositoryContract {
  #chunks: Chunk[] = []; //TODO: maybe remove?

  getChunksAsync = async (path: string): Promise<Chunk[]> => {
    this.#chunks = await this.loadJSON(path);
    return [...this.#chunks];
  };

  getCachedChunksSync = (): Chunk[] => [...this.#chunks];
}
