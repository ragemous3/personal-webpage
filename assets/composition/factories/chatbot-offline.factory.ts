import { ApiBase } from '@/layers/data/abstracts/base.infra';
import { ConfigurationRepository } from '@/layers/data/configuration-repository.data';
import { ContentRepository } from '@/layers/data/content-repository.data';
import { Chat } from '@/layers/data/local-chat-lm.data';
import { DB } from '@/layers/data/local-vector-database.data';
import { ModelMetadataRepository } from '@/layers/data/model-metadata-repository.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RuntimeConfigurationAdapter } from '@/layers/data/runtime-configuration.adapter';
import { RagService } from '@/layers/services/chatbot.service';
import { ConfigurationService } from '@/layers/services/configuration.service';
import { type ModelDescriptor } from '@/layers/shared/models/model-metadata.model';

import { getOfflineConfiguration } from './offline-configuration.factory';
import { getRuntimeCoordinator } from './runtime-coordinator.factory';

interface ChatbotOfflineDependencies {
  service: RagService;
  settings: ConfigurationService;
  dispose(): void;
}

export const buildChatbotOfflineDeps = (
  cfg: unknown,
  events: EventTarget & Pick<Window, 'localStorage' | 'caches'>,
): ChatbotOfflineDependencies => {
  const configuration = getOfflineConfiguration(cfg);
  let storage: Storage | undefined;
  try {
    storage = events.localStorage;
  } catch {
    storage = undefined;
  }
  let cache: CacheStorage | undefined;
  try {
    cache = events.caches;
  } catch {
    cache = undefined;
  }
  const model = configuration.model.payload;
  const models: ModelDescriptor[] = [
    { id: model.model, label: model.model, revision: model.revision ?? '', precision: model.dtype },
  ];
  const metadata = new ModelMetadataRepository(new ApiBase(configuration.baseURL), models, {
    cache,
    modelBaseUrl: model.modelBaseUrl,
    metadataBaseUrl: configuration.modelMetadataBaseURL,
  });
  const repository = new ConfigurationRepository(storage, events);
  const coordinator = getRuntimeCoordinator(cfg);
  const chat = new Chat(coordinator, configuration.model, false);
  const database = new DB(coordinator, configuration.database, false);
  const service = new RagService(
    chat,
    database,
    new ContentRepository(configuration.baseURL),
    new ChatMessageModel({ role: 'system', content: configuration.systemMessage }),
    coordinator,
  );
  const adapter = new RuntimeConfigurationAdapter(
    coordinator,
    chat,
    database,
    service.setAvailable,
    models,
  );
  const settings = new ConfigurationService(repository, adapter, metadata);
  service.init();
  return {
    service,
    settings,
    dispose: (): void => {
      settings.dispose();
      adapter.dispose();
      service.dispose();
      chat.dispose();
      database.dispose();
    },
  };
};
