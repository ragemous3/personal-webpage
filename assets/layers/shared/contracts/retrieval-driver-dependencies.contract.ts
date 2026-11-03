import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { type VectorDBHNSWData } from '@/layers/data/vectordb-hnsw.data';

export interface RetrievalDriverDependenciesContract {
  create(config: DatabaseConfig): Pick<VectorDBHNSWData, 'init' | 'query' | 'dispose'>;
  publish(message: unknown): void;
}
