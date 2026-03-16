import { EntityStatusTypes } from './constants';
import {
  EntityName,
  EntityProtocol,
  EntityStatus,
  EntityStatusLog,
  EntityTask,
  SharedWorkerMessage,
} from './models';

const ports = new Set<MessagePort>();
const processStatusTracker = new Map<EntityName, EntityStatusLog>();

const setStatus = (entityName: EntityName, payload: EntityStatusLog): void => {
  processStatusTracker.set(entityName, payload);
};

const checkStatus = (p: MessagePort, entityName: EntityName, msg: SharedWorkerMessage) =>
  processStatusTracker.get(entityName)
    ? p.postMessage(processStatusTracker.get(entityName))
    : p.postMessage({
        id: msg.id,
        entity: entityName,
        status: EntityStatusTypes.UNINITIALIZED,
      });

const isEntityTask = (task: string | undefined): task is EntityTask =>
  (task && 'check' === task) || 'transfer' === task || 'set' === task ? true : false;

const isEntityStatus = (entityStatus: unknown): entityStatus is EntityStatus =>
  entityStatus &&
  typeof entityStatus === 'string' &&
  (EntityStatusTypes.READY === entityStatus ||
    EntityStatusTypes.BUSY === entityStatus ||
    EntityStatusTypes.UNINITIALIZED === entityStatus)
    ? true
    : false;

const disectTask = (task: EntityProtocol): { entityTask: EntityTask; entityName: EntityName } => {
  try {
    const splitTask = task.split(':');
    const entityName: EntityName | undefined = splitTask[0];
    const entityTask: string | undefined = splitTask[1];

    if (!entityName || entityTask) {
      throw new Error('Protocol string not properly defined');
    }

    if (!isEntityTask(entityTask)) {
      throw new Error('task field is malformed');
    }

    return { entityTask, entityName };
  } catch (e) {
    throw new Error(`Something went wrong ${e}`);
  }
};

const sharedWorkerSwitch = (p: MessagePort, msg: SharedWorkerMessage): void => {
  const { entityName, entityTask } = disectTask(msg.task);
  switch (entityTask) {
    case 'check':
      const status = msg.payload;
      if (isEntityStatus(status)) {
        setStatus(entityName, {
          initiator: msg.id,
          entity: entityName,
          status,
        });
      }
    case 'set':
      checkStatus(p, entityName, msg);
    case 'transfer':
      p.postMessage(msg);
      break;
  }
};

onconnect = (event: MessageEvent<SharedWorkerMessage>): void => {
  const port = event.ports[0];
  if (!port) throw new Error('Port was not found');
  ports.add(port);
  port.start();
  port.onmessage = (e) => {
    ports.forEach((p) => sharedWorkerSwitch(p, e.data));
  };
};
