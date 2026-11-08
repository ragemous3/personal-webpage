import { type DatabaseConfig, type LmConfig } from '@/layers/data/models/chatbot-config.model';
import { type RagConfigBase } from '@/layers/shared/models/rag-config.model';

export interface ChatbotConfiguration {
  onlineApiBaseURL: string;
  modelMetadataBaseURL?: string | undefined;
  baseURL: string;
  systemMessage: string;
  coordinatorSource: string;
  model: RagConfigBase<LmConfig>;
  database: RagConfigBase<DatabaseConfig>;
}
