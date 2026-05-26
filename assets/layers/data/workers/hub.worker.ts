import { isInitConfigBase } from '@/layers/data/guards/is-init-config-base.guard';
import { isMessageBase } from '@/layers/data/guards/is-message-base.guard';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { isRecord } from '@/layers/shared/guards/guards';

import { type MessageBase, type WorkerMessageHub } from './models';
import { WebWorkerManager } from './web-worker-manager';

const workers = new Map<string, WebWorkerManager<MessageBase<unknown>, unknown>>();

const init = (package_: unknown, payload: unknown): void => {
  if (
    !package_ ||
    !isMessageBase(package_, isRecord) ||
    !package_.name ||
    !payload ||
    !isInitConfigBase(payload)
  ) {
    throw new Error(`$[${SeverityLevelCodes.ERROR}] - Missing necessary data to perform task`);
  }

  const ww = new WebWorkerManager(payload.source, package_.name);
  ww.listen((data) => {
    postMessage(data);
  }); // this is where data gets sent BACK to any listener of the hub :).
  ww.initialize(package_);
  workers.set(package_.name, ww);
};

export const isWebWorkerManager = <
  To extends MessageBase<unknown> = MessageBase<unknown>,
  From = unknown,
>(
  value: unknown,
): value is WebWorkerManager<To, From> => {
  return value instanceof WebWorkerManager;
};

const postToWorker = (payload: MessageBase<unknown>): undefined => {
  const worker = workers.get(payload.name);
  if (!isWebWorkerManager(worker))
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Expected a defined worker!`);
  // TODO: hub string is hardcoded value
  if (payload.name === 'hub')
    throw new Error(`[${SeverityLevelCodes.ERROR}] - hub keyword not allowed`);
  worker.send(payload);
};

const post = (payload: MessageBase<unknown>): void => {
  postMessage(payload);
};

onmessage = (messageEvent: MessageEvent<WorkerMessageHub>): void => {
  const { task, payload }: Partial<WorkerMessageHub> = messageEvent.data;

  try {
    // TODO - Switch to response return task
    // Check if alive (pings back same msg)
    if (task === 'hub:ping') post(messageEvent.data);
    // host a data entity -> pings back task on success
    if (task === 'hub:host') init(payload, payload.payload);
    // query the data entity
    if (task === 'hub:query') postToWorker(payload);
  } catch (error: unknown) {
    if (error instanceof Error) {
      postMessage({
        ...messageEvent.data,
        error: {
          name: `[${SeverityLevelCodes.ERROR}]${error.name}`,
          message: error.message,
          stack: error.stack,
        },
      });
      return;
    }

    postMessage({
      ...messageEvent.data,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(error),
        stack: null,
      },
    });
  }
};

// TODO:// Attach ID to the error
onmessageerror = (error: unknown) => {
  postMessage(error);
};
