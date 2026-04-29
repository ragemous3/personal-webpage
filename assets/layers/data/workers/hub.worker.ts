import { SeverityLevelCodes } from '../../shared/constants';
import { isMessageBase, isNullPayload } from '../guards/is-message-base';
import { MessageBase, WorkerMessageHub } from './models';
import { WebWorkerManager } from './web-worker-manager';

const workers = new Map<string, WebWorkerManager<MessageBase<unknown>, unknown>>();

const throwOnMissingData = () => {
  throw new Error(`$[${SeverityLevelCodes.ERROR}] - Missing necessary data to perform task`);
};

const init = async (pkg: MessageBase<unknown>): Promise<void> => {
  if (!pkg || !isMessageBase(pkg, isNullPayload) || !pkg?.source || !pkg?.name) {
    throw throwOnMissingData();
  }

  const ww = new WebWorkerManager(pkg.source, pkg.name);
  ww.listen((data) => postMessage(data)); // this is where data gets sent BACK to any listener of the hub :).
  ww.initialize(pkg);
  workers.set(pkg.name, ww);
};

export const isWebWorkerManager = <
  To extends MessageBase<unknown> = MessageBase<unknown>,
  From = unknown,
>(
  value: unknown,
): value is WebWorkerManager<To, From> => {
  return value instanceof WebWorkerManager;
};

const postToWorker = (payload: MessageBase<unknown>): false | void => {
  const worker = workers.get(payload.name);
  if (!isWebWorkerManager(worker))
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a defined worker!`);
  // TODO: hub string is hardcoded value
  if (payload.name === 'hub')
    throw new Error(`[${SeverityLevelCodes.ERROR}] - hub keyword not allowed`);
  worker.send(payload);
};

const post = (payload: MessageBase<unknown>): void => postMessage(payload);

onmessage = async (msgEvent: MessageEvent<WorkerMessageHub>): Promise<void> => {
  const { task, payload }: Partial<WorkerMessageHub> = msgEvent.data;

  try {
    // TODO - Switch to response return task
    // Check if alive (pings back same msg)
    if (task === 'hub:ping') post(msgEvent.data);
    // host a data entity -> pings back task on success
    if (task === 'hub:host') await init(payload);
    // query the data entity
    if (task === 'hub:query') postToWorker(payload);
  } catch (err: unknown) {
    if (err instanceof Error) {
      postMessage({
        ...msgEvent.data,
        error: {
          name: `[${SeverityLevelCodes.ERROR}]${err.name}`,
          message: err.message,
          stack: err.stack,
        },
      });
      return;
    }

    postMessage({
      ...msgEvent.data,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(err),
        stack: null,
      },
    });
  }
};

// TODO:// Attach ID to the error
onmessageerror = (err: unknown) => postMessage(err);
