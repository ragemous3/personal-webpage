import { type Chunk } from '@/layers/data/models/models';

import { type ApiContract } from './api.contract';

export interface ContentRepositoryContract extends ApiContract {
  getChunksAsync(path: string): Promise<Chunk[]>;
  getCachedChunksSync(): Chunk[];
}
