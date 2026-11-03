import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ProgressServiceContract } from '@/layers/shared/contracts/progress-service.contract';
import { type RuntimeCoordinatorContract } from '@/layers/shared/contracts/runtime-coordinator.contract';
import { isProgressInfo } from '@/layers/shared/guards/progress.guard';
import { type ProgressInfo } from '@/layers/shared/models/progress.model';
import {
  createSubscribable,
  type Unsubscribeable,
  type WritableConnections,
} from '@/layers/shared/utils/subscribable';

export class ProgressService implements ProgressServiceContract<Map<string, ProgressInfo>> {
  readonly #$data: WritableConnections<Map<string, ProgressInfo>> = createSubscribable();
  #initialized = false;
  unsubs: Unsubscribeable[] = [];
  progressInfo = new Map<string, ProgressInfo>();

  constructor(protected coordinator: Pick<RuntimeCoordinatorContract, 'onData'>) {
    this.#init();
  }

  connect = (callback: (message: Map<string, ProgressInfo>) => void): Unsubscribeable => {
    const disconnect = this.#$data.connect(callback);
    callback(this.progressInfo);
    return disconnect;
  };

  readonly #handleProgressStatus = (name: string, data: ProgressInfo): void => {
    this.progressInfo.set(name, data);
    this.#$data.emit(this.progressInfo);
  };

  readonly #init = (): void => {
    if (this.#initialized) {
      console.error(`[${SeverityLevelCodes.WARNING}] - Init was called twice..`);
    }
    this.#initialized = true;
    this.unsubs.push(
      this.coordinator.onData((data) => {
        if (
          typeof data === 'object' &&
          data &&
          'payload' in data &&
          'name' in data &&
          typeof data.name === 'string' &&
          isProgressInfo(data.payload)
        )
          this.#handleProgressStatus(data.name, data.payload);
      }),
    );
  };

  dispose = (): void => {
    for (const unsub of this.unsubs) unsub();
  };
}
