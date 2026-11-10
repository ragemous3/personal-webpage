import { type ChatbotConfiguration } from '@/composition/models/chatbot-configuration.model';
import { type ChatHistoryRepository } from '@/layers/data/chat-history-repository.data';
import { type DB } from '@/layers/data/local-vector-database.data';
import { type RuntimeCoordinator } from '@/layers/data/runtime-coordinator.data';
import { type ConfigurationService } from '@/layers/services/configuration.service';
import { type RagService } from '@/layers/services/rag.service';
import { type TalkingHeadServiceContract } from '@/layers/shared/contracts/talking-head-service.contract';

export interface ChatbotDependencies {
  configuration: ChatbotConfiguration;
  coordinator: RuntimeCoordinator;
  database: DB;
  history: ChatHistoryRepository;
  conversationId: string;
  settings: ConfigurationService;
  bind(service: RagService): () => void;
  dispose(): void;
}

export interface RagDependencies {
  speech: TalkingHeadServiceContract;
  service: RagService;
  dispose(): void;
}
