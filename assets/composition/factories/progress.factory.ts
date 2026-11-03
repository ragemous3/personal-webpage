import { ProgressService } from '@/layers/services/progress.service';

import { getRuntimeCoordinator } from './runtime-coordinator.factory';

let progress: ProgressService | undefined;

export const progressFactory = (cfg: unknown): ProgressService => {
  const runtime = getRuntimeCoordinator(cfg);
  progress ??= new ProgressService(runtime);
  return progress;
};
