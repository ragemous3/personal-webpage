import { RuntimeCoordinatorConnection } from '@/layers/data/runtime-coordinator.connection';
import { RuntimeCoordinator } from '@/layers/data/runtime-coordinator.data';

import { getOfflineConfiguration } from './offline-configuration.factory';

let runtime: RuntimeCoordinator | undefined;
export const getRuntimeCoordinator = (cfg: unknown): RuntimeCoordinator => {
  const configuration = getOfflineConfiguration(cfg);
  runtime ??= new RuntimeCoordinator(
    new RuntimeCoordinatorConnection(configuration.coordinatorSource, {
      llm: configuration.model.payload.source,
      vectordb: configuration.database.payload.source,
    }),
  );
  return runtime;
};
