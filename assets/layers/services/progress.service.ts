import { SeverityLevelCodes } from '../shared/constants';
import { ProgressServiceContract } from '../shared/contracts/progress-service.contract';
import {
  createSubscribable,
  Unsubscribeable,
  WritableConnections,
} from '../shared/utils/subscribable';
import { MessageBase } from '../data/workers/models';
import { isProgressInfo } from '../shared/guards/progress.guard';
import { ProgressInfo } from '../shared/models/progress.model';
import { BroadcastContract } from '../shared/contracts/broadcast-port.contract';

export class ProgressService implements ProgressServiceContract<Map<string, ProgressInfo>> {
  #$data: WritableConnections<Map<string, ProgressInfo>> = createSubscribable();
  #initialized = false;
  unsubs: Unsubscribeable[] = [];
  progressInfo = new Map<string, ProgressInfo>();

  constructor(
    protected broadcasts: BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>[],
  ) {
    this.#init();
  }

  connect = (callback: (message: Map<string, ProgressInfo>) => void): Unsubscribeable =>
    this.#$data.connect(callback);

  #handleProgressStatus = (name: string, data: ProgressInfo) => {
    this.progressInfo.set(name, data);
    this.#$data.emit(this.progressInfo);
  };

  #init = async () => {
    if (this.#initialized) {
      console.warn(`${SeverityLevelCodes.WARNING} Init was called twice..`);
    }
    this.#initialized = true;

    console.log(`Progress Init started`);
    this.broadcasts.forEach((broadcast) => {
      this.unsubs.push(
        broadcast.listen(async (data: MessageBase<ProgressInfo | unknown>) => {
          if (data?.payload && isProgressInfo(data.payload))
            this.#handleProgressStatus(data.name, data.payload);
        }),
      );
    });
    console.log(`Progress Init finished`);
  };

  dispose = () => {
    this.unsubs.forEach((unsub) => unsub());
  };
}
