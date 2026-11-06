import { SharedWorkerNames } from '@/layers/data/contants/constants';
import { isRuntimeMessage } from '@/layers/data/guards/is-runtime-message.guard';
import { SharedWorkerManager } from '@/layers/data/workers/shared-worker-manager.data';
import { isRecord } from '@/layers/shared/guards/guards';
import {
  defaultRuntimePolicy,
  type RuntimeMessage,
  type RuntimePolicy,
  type RuntimeRole,
} from '@/layers/shared/models/runtime.model';

export class RuntimeCoordinatorConnection extends SharedWorkerManager<RuntimeMessage> {
  readonly clientId = crypto.randomUUID();
  readonly #models = new Map<RuntimeRole, SharedWorkerManager<RuntimeMessage>>();
  readonly #modelInstances = new Map<RuntimeRole, string>();
  readonly #registrations = new Map<RuntimeRole, { attempt: number; promise: Promise<void> }>();
  #attempt = 0;
  #attached = false;
  #roles: RuntimeRole[] = [];
  constructor(
    scriptPath: string,
    private readonly sources: Record<RuntimeRole, string>,
    readonly policy: Partial<RuntimePolicy> = {},
  ) {
    super(scriptPath, SharedWorkerNames.coordinator);
    this.listenErrors(this.#coordinatorFailure);
    this.listen(this.#observeResources);
    if ('addEventListener' in globalThis) globalThis.addEventListener('pagehide', this.#departure);
    if ('addEventListener' in globalThis)
      globalThis.addEventListener('pageshow', this.#restoration);
  }

  get attachmentVersion(): number {
    return this.#attempt;
  }

  connect = (): void => {
    this.#attempt++;
    this.initialize();
    this.#attached = true;
    this.emit({ id: this.clientId, name: 'coordinator', task: 'runtime:attach', payload: null });
    this.control('runtime:attach', { policy: this.policy });
    for (const role of this.#roles) this.#connectModel(role, this.#attempt);
  };

  reconnect = (): void => {
    this.terminate();
    this.connect();
  };

  control = (
    task: RuntimeMessage['task'],
    payload: unknown = null,
    requestId?: string,
    transfer: Transferable[] = [],
  ): void => {
    this.send(
      {
        id: this.clientId,
        name: 'coordinator',
        task,
        payload,
        ...(requestId ? { requestId } : {}),
      },
      transfer,
    );
  };

  dispose = (): void => {
    if ('removeEventListener' in globalThis)
      globalThis.removeEventListener('pagehide', this.#departure);
    if ('removeEventListener' in globalThis)
      globalThis.removeEventListener('pageshow', this.#restoration);
    this.#departure();
    for (const model of this.#models.values()) model.terminate();
    this.#models.clear();
  };

  ensureModels = async (roles: RuntimeRole[] = ['llm', 'vectordb']): Promise<void> => {
    this.#roles = [...new Set([...this.#roles, ...roles])];
    await Promise.all(roles.map((role) => this.#ensureModel(role)));
  };

  readonly #ensureModel = (role: RuntimeRole): Promise<void> => {
    const pending = this.#registrations.get(role);
    if (pending?.attempt === this.#attempt) return pending.promise;
    if (this.#models.has(role)) return Promise.resolve();
    const attempt = this.#attempt;
    const registration = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Model connection deadline exceeded')),
        this.policy.connectionMs ?? defaultRuntimePolicy.connectionMs,
      );
      this.#connectModel(role, this.#attempt, {
        connected: () => {
          clearTimeout(timer);
          resolve();
        },
        failed: (reason) => {
          clearTimeout(timer);
          reject(new Error(reason));
        },
      });
    })
      .catch((error: unknown) => {
        if (attempt === this.#attempt && this.#registrations.get(role)?.promise === registration) {
          this.#models.get(role)?.terminate();
          this.#models.delete(role);
        }
        throw error;
      })
      .finally(() => {
        if (this.#registrations.get(role)?.promise === registration)
          this.#registrations.delete(role);
      });
    this.#registrations.set(role, { attempt, promise: registration });
    return registration;
  };

  readonly #connectModel = (
    role: RuntimeRole,
    attempt: number,
    repair?: { connected(): void; failed(reason: string): void },
  ): void => {
    const previous = this.#models.get(role);
    this.#modelInstances.delete(role);
    const model = new SharedWorkerManager<RuntimeMessage>(
      this.sources[role],
      SharedWorkerNames[role],
    );
    this.#models.set(role, model);
    let instanceId: string | undefined;
    const disconnect = model.listen((message) => {
      if (
        attempt !== this.#attempt ||
        !isRuntimeMessage(message) ||
        message.task !== 'runtime:state' ||
        !isRecord(message.payload) ||
        typeof message.payload.instanceId !== 'string'
      )
        return;
      instanceId = message.payload.instanceId;
      this.#modelInstances.set(role, instanceId);
      disconnect();
      const port = model.takePort();
      this.control(
        'runtime:register',
        { role, port, instanceId, deferConfiguration: repair !== undefined },
        undefined,
        [port],
      );
      repair?.connected();
    });
    model.listenErrors((reason) => {
      repair?.failed(reason);
      if (this.carrier && attempt === this.#attempt && instanceId)
        this.control('runtime:failed', { role, instanceId, reason });
    });
    try {
      model.initialize();
      previous?.terminate();
    } catch (error) {
      repair?.failed(String(error));
      this.#coordinatorFailure(String(error));
    }
  };

  readonly #observeResources = (message: RuntimeMessage): void => {
    if (
      message.task !== 'runtime:state' ||
      !isRecord(message.payload) ||
      !Array.isArray(message.payload.resources)
    )
      return;
    for (const resource of message.payload.resources) this.#releaseFailedModel(resource);
  };
  readonly #releaseFailedModel = (resource: unknown): void => {
    if (
      !isRecord(resource) ||
      resource.status !== 'failed' ||
      (resource.role !== 'llm' && resource.role !== 'vectordb')
    )
      return;
    if (resource.instanceId !== this.#modelInstances.get(resource.role)) return;
    this.#models.get(resource.role)?.terminate();
    this.#models.delete(resource.role);
    this.#modelInstances.delete(resource.role);
  };
  readonly #coordinatorFailure = (reason: string): void => {
    console.error('RuntimeCoordinator transport failure:', reason);
    this.emit({
      id: this.clientId,
      name: 'coordinator',
      task: 'runtime:failed',
      payload: { reason },
      runtimeFailure: true,
    });
  };
  readonly #departure = (): void => {
    if (!this.#attached) return;
    if (this.carrier) this.control('runtime:detach');
    this.#attached = false;
    this.terminate();
    this.emit({ id: this.clientId, name: 'coordinator', task: 'runtime:detach', payload: null });
  };
  readonly #restoration = (): void => {
    if (!this.#attached) this.reconnect();
  };
}
