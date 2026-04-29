import { createContext } from '@lit/context';
import { ProgressServiceContract } from '../../layers/shared/contracts/progress-service.contract';
import { ProgressInfo } from '../../layers/shared/models/progress.model';
export const progressContext = createContext<ProgressServiceContract<Map<string, ProgressInfo>>>(
  Symbol('progressService'),
);
