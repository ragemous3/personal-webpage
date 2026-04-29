import { Chunk } from '../../data/models/models';
import { ApiContract } from './api.contract';

export interface ContentRepositoryContract extends ApiContract {
  getChunksAsync(path: string): Promise<Chunk[]>;
  getCachedChunksSync(): Chunk[];
}
