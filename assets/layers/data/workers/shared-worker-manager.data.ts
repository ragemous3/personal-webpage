import { WorkerBase } from '@/layers/data/abstracts/worker-base.abstract';
import { type MessageBase } from '@/layers/data/workers/models';

export class SharedWorkerManager<
  To extends MessageBase<unknown>,
  From = unknown,
> extends WorkerBase<MessagePort, To, From> {
  worker: SharedWorker | undefined;
  readonly #faults = new Set<(reason: string) => void>();

  initialize = (): void => {
    if (this.carrier) return;
    const worker = new SharedWorker(new URL(this.scriptPath, import.meta.url), {
      type: 'module',
      name: this.carrierName,
    });
    this.worker = worker;
    this.carrier = worker.port;
    worker.addEventListener('error', this.#fault);
    this.setupEventListeners();
    this.carrier.start();
  };

  listenErrors = (listener: (reason: string) => void): (() => void) => {
    this.#faults.add(listener);
    return () => {
      this.#faults.delete(listener);
    };
  };

  send = (message: To, transfer: Transferable[] = []): void => {
    if (!this.carrier) throw new Error('SharedWorker is not connected');
    this.carrier.postMessage(message, transfer);
  };

  takePort = (): MessagePort => {
    if (!this.carrier) throw new Error('SharedWorker is not connected');
    const port = this.carrier;
    this.#removePortListeners(port);
    this.carrier = undefined;
    return port;
  };

  terminate = (): void => {
    if (this.carrier) {
      this.#removePortListeners(this.carrier);
      this.carrier.close();
    }
    this.worker?.removeEventListener('error', this.#fault);
    this.carrier = undefined;
    this.worker = undefined;
  };

  protected setupEventListeners = (): undefined => {
    this.carrier?.addEventListener('message', this.handleMessage);
    this.carrier?.addEventListener('messageerror', this.#fault);
    this.carrier?.addEventListener('close', this.#fault);
  };

  readonly #removePortListeners = (port: MessagePort): void => {
    port.removeEventListener('message', this.handleMessage);
    port.removeEventListener('messageerror', this.#fault);
    port.removeEventListener('close', this.#fault);
  };
  readonly #fault = (event: Event): void => {
    const reason = event instanceof ErrorEvent ? event.message : 'SharedWorker transport failed';
    this.terminate();
    for (const listener of this.#faults) listener(reason);
  };
}
