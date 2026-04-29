import { MessageBase } from './workers/models';
import { WebWorkerManager } from './workers/web-worker-manager';

export class HubConnection extends WebWorkerManager<MessageBase<unknown>, unknown> {
  constructor(
    protected scriptPath: string,
    protected carrierName: string,
  ) {
    super(scriptPath, carrierName);
  }
}
