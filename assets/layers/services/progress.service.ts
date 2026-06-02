import { type MessageBase } from '@/layers/data/workers/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';
import { type ProgressServiceContract } from '@/layers/shared/contracts/progress-service.contract';
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

  constructor(
    protected broadcasts: Array<BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>>,
  ) {
    this.#init();
  }

  connect = (callback: (message: Map<string, ProgressInfo>) => void): Unsubscribeable =>
    this.#$data.connect(callback);

  readonly #handleProgressStatus = (name: string, data: ProgressInfo): void => {
    this.progressInfo.set(name, data);
    this.#$data.emit(this.progressInfo);
  };

  readonly #init = (): void => {
    if (this.#initialized) {
      console.error(`${SeverityLevelCodes.WARNING} Init was called twice..`);
    }
    this.#initialized = true;
    for (const broadcast of this.broadcasts) {
      this.unsubs.push(
        broadcast.listen((data: MessageBase<unknown>) => {
          if (typeof data === 'object' && data.payload && isProgressInfo(data.payload))
            this.#handleProgressStatus(data.name, data.payload);
        }),
      );
    }
  };

  dispose = (): void => {
    for (const unsub of this.unsubs) unsub();
  };
}
