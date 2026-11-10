import {
  type ChatbotDependencies,
  type RagDependencies,
} from '@/composition/models/chatbot-dependencies.model';
import { tryReadBrowserValue } from '@/composition/utils/browser-access.utility';
import { ChatHistoryRepository } from '@/layers/data/chat-history-repository.data';
import { ConfigurationRepository } from '@/layers/data/configuration-repository.data';
import { ContentRepository } from '@/layers/data/content-repository.data';
import { ConversationIdentity } from '@/layers/data/conversation-identity.data';
import { ModelMetadataRepository } from '@/layers/data/model-metadata-repository.data';
import { ChatMessageModel } from '@/layers/data/models/chat.model';
import { OnlineModelRepository } from '@/layers/data/online-model-repository.data';
import { RuntimeConfigurationAdapter } from '@/layers/data/runtime-configuration.adapter';
import { TalkingHeadAdapter } from '@/layers/data/talking-head.adapter';
import { ConfigurationService } from '@/layers/services/configuration.service';
import { RagService } from '@/layers/services/rag.service';
import { TalkingHeadService } from '@/layers/services/talking-head.service';
import { type ChatGenerationContract } from '@/layers/shared/contracts/chat-generation.contract';
import { type SpeechSynthesisContract } from '@/layers/shared/contracts/speech-synthesis.contract';
import { type ModelDescriptor } from '@/layers/shared/models/model-metadata.model';

import { getVectorDatabase } from './local-vector-database.factory';
import { getOfflineConfiguration } from './offline-configuration.factory';
import { getRuntimeCoordinator } from './runtime-coordinator.factory';

export const buildChatbotDeps = (cfg: unknown, browser: typeof globalThis): ChatbotDependencies => {
  const configuration = getOfflineConfiguration(cfg);
  const model = configuration.model.payload;
  const models: ModelDescriptor[] = [
    { id: model.model, label: model.model, revision: model.revision ?? '', precision: model.dtype },
  ];
  const metadata = new ModelMetadataRepository(configuration.baseURL, models, {
    cache: tryReadBrowserValue(() => browser.caches),
    modelBaseUrl: model.modelBaseUrl,
    metadataBaseUrl: configuration.modelMetadataBaseURL,
  });
  const coordinator = getRuntimeCoordinator(cfg);
  const database = getVectorDatabase(coordinator, configuration.database, true, false);
  const history = new ChatHistoryRepository(tryReadBrowserValue(() => browser.indexedDB));
  const conversationId = new ConversationIdentity(
    tryReadBrowserValue(() => browser.sessionStorage),
  ).getId(
    tryReadBrowserValue(
      () =>
        (
          browser.performance.getEntriesByType('navigation')[0] as
            | PerformanceNavigationTiming
            | undefined
        )?.type,
    ),
  );
  let current: RagService | undefined;
  const adapter = new RuntimeConfigurationAdapter(
    coordinator,
    { configuration: configuration.model },
    database,
    (available) => current?.setAvailable(available),
    models,
  );
  const settings = new ConfigurationService(
    new ConfigurationRepository(
      tryReadBrowserValue(() => browser.localStorage),
      browser,
    ),
    adapter,
    metadata,
    new OnlineModelRepository(configuration.onlineApiBaseURL),
  );
  return {
    configuration,
    coordinator,
    database,
    history,
    conversationId,
    settings,
    bind(service: RagService): () => void {
      current = service;
      service.setAvailable(settings.stateSubscription.getValue()?.available ?? false);
      return () => {
        if (current === service) current = undefined;
      };
    },
    dispose(): void {
      const service = current;
      service?.cancel();
      settings.dispose();
      adapter.dispose();
      database.dispose();
      if (service) void service.whenSettled().then(() => history.dispose());
      else history.dispose();
    },
  };
};

export const buildRagService = (
  chat: ChatGenerationContract,
  shared: ChatbotDependencies,
  synthesis: SpeechSynthesisContract,
): RagDependencies => {
  const service = new RagService(
    chat,
    shared.database,
    new ContentRepository(shared.configuration.baseURL),
    new ChatMessageModel({ role: 'system', content: shared.configuration.systemMessage }),
    {
      history: shared.history,
      conversationId: shared.conversationId,
      runtime: {
        onData: shared.coordinator.onData,
        begin: shared.coordinator.begin,
        finish: shared.coordinator.finish,
        reconnect: async (): Promise<void> => {
          await shared.coordinator.reconnect();
          shared.settings.retry();
        },
      },
    },
  );
  const unbind = shared.bind(service);
  service.init();
  const speech = new TalkingHeadService(
    chat,
    service.lifecycleSubscription,
    synthesis,
    new TalkingHeadAdapter(shared.configuration.baseURL),
    {
      available: shared.settings.stateSubscription.getValue()?.available ?? false,
    },
  );
  return {
    service,
    speech,
    dispose(): void {
      unbind();
      speech.dispose();
      service.dispose();
      chat.dispose();
    },
  };
};
