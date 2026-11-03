import { ApiBase } from '@/layers/data/abstracts/base.infra';
import { isDatabaseConfig } from '@/layers/data/guards/is-database-config.guard';
import { IndexDBBase } from '@/layers/data/idb-base.data';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { VectorDBHNSWData } from '@/layers/data/vectordb-hnsw.data';
import { type RetrievalDriverDependenciesContract } from '@/layers/shared/contracts/retrieval-driver-dependencies.contract';
import { type SharedModelDriverContract } from '@/layers/shared/contracts/shared-model-driver.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { type RuntimeMessage } from '@/layers/shared/models/runtime.model';
import { areValuesEqual } from '@/layers/shared/utils/value-equality.utility';

import { configureModelEnvironment } from './model-environment.data';
import { SharedModelRuntime } from './shared-model-runtime.data';

export const createRetrievalDriver = (
  dependencies: RetrievalDriverDependenciesContract,
): SharedModelDriverContract => {
  let database: ReturnType<RetrievalDriverDependenciesContract['create']> | undefined;
  let initialization: Promise<void> | undefined;
  let configuration: DatabaseConfig | undefined;
  const initialize = async (request: RuntimeMessage): Promise<void> => {
    if (!isDatabaseConfig(request.payload)) throw new Error('Invalid database configuration');
    if (configuration && !areValuesEqual(configuration, request.payload))
      throw new Error('Database initialized with a different configuration');
    configuration = request.payload;
    if (!initialization) {
      database = dependencies.create(configuration);
      const instance = database;
      initialization = instance
        .init((progress) =>
          dependencies.publish({
            ...request,
            task: 'vectordb:progress:response',
            payload: progress,
          }),
        )
        .catch(async (error: unknown) => {
          initialization = undefined;
          configuration = undefined;
          database = undefined;
          await instance.dispose();
          throw error;
        });
    }
    await initialization;
    dependencies.publish({ ...request, task: 'vectordb:ready', payload: null });
  };
  return {
    handle: async ({ data: request }: MessageEvent<RuntimeMessage>): Promise<void> => {
      if (request.task === 'vectordb:init') await initialize(request);
      if (request.task === 'vectordb:query') {
        if (!database || !isRecord(request.payload) || typeof request.payload.query !== 'string')
          throw new Error('Expected a query and a ready retrieval model');
        const query = request.payload.query;
        const response = await database.query(query);
        dependencies.publish({
          ...request,
          task: 'vectordb:query:response',
          payload: { response, query },
        });
      }
    },
    dispose: async (): Promise<void> => {
      await database?.dispose();
      database = undefined;
      initialization = undefined;
      configuration = undefined;
    },
  };
};
if ('onconnect' in globalThis) {
  const runtime = new SharedModelRuntime('vectordb', (publish) =>
    createRetrievalDriver({
      publish,
      create: (config) => {
        configureModelEnvironment(config);
        return new VectorDBHNSWData(
          config,
          new ApiBase(config.baseUrl),
          new IndexDBBase(config.indexStoreName),
        );
      },
    }),
  );
  globalThis.addEventListener('connect', (event: Event) => {
    const port = (event as MessageEvent).ports[0];
    if (port) runtime.connect(port);
  });
}
