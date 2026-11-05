import { ConfigurationRepository } from '@/layers/data/configuration-repository.data';
import { ContentRepository } from '@/layers/data/content-repository.data';
import { Chat } from '@/layers/data/local-chat-lm.data';
import { DB } from '@/layers/data/local-vector-database.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { RuntimeConfigurationAdapter } from '@/layers/data/runtime-configuration.adapter';
import { RagService } from '@/layers/services/chatbot.service';
import { ConfigurationService } from '@/layers/services/configuration.service';

import { getOfflineConfiguration } from './offline-configuration.factory';
import { getRuntimeCoordinator } from './runtime-coordinator.factory';

interface ConfigurableChatbotDependencies {
  service: RagService;
  settings: ConfigurationService;
  dispose(): void;
}

export const buildConfigurableChatbotDeps = (
  cfg: unknown,
  events: EventTarget & Pick<Window, 'localStorage'>,
): ConfigurableChatbotDependencies => {
  const configuration = getOfflineConfiguration(cfg);
  let storage: Storage | undefined;
  try {
    storage = events.localStorage;
  } catch {
    storage = undefined;
  }
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
  const adapter = new RuntimeConfigurationAdapter(coordinator, chat, database, service.setAvailable);
  const settings = new ConfigurationService(repository, adapter);
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
