/// <reference lib="webworker" />
import { StateMachineStatesEnum } from '@/layers/data/contants/constants';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type Nullable } from '@/layers/shared/models';

import {
  type SharedWorkerMessage,
  type StateMachineName,
  type StateMachineProtocol,
  type StateMachineStatusLog,
  type StateMachineTask,
} from './models';

const ports = new Set<MessagePort>();
const processStatusTracker = new Map<StateMachineName, StateMachineStatusLog>();

const setStatus = (entityName: StateMachineName, payload: StateMachineStatusLog): boolean => {
  processStatusTracker.set(entityName, payload);
  return true;
};

/*
 * Whole point here is to only have 1 live instance of something at a time.
 * If users open more tabs, another init is not necessary.
 */
const checkStatus = (
  port: MessagePort,
  entityName: StateMachineName,
  message: SharedWorkerMessage,
): void => {
  const status = processStatusTracker.get(entityName);
  if (status) {
    port.postMessage({ ...message, payload: status });
    return;
  }
  setStatus(entityName, {
    initiator: message.id,
    entity: entityName,
    status: StateMachineStatesEnum.BUSY,
  });
  port.postMessage({
    ...message,
    payload: {
      initiator: message.id,
      entity: entityName,
      status: StateMachineStatesEnum.UNINITIALIZED,
    },
  });
};

const isStateMachineTask = (task: string | undefined): task is StateMachineTask =>
  (task && 'check' === task) || 'transfer' === task || 'set' === task ? true : false;

const isStateMachineState = (state: unknown): state is StateMachineStatesEnum =>
  state === StateMachineStatesEnum.BUSY || state === StateMachineStatesEnum.UNINITIALIZED;

const disectTask = (
  task: StateMachineProtocol,
): Nullable<{ entityTask: StateMachineTask; entityName: StateMachineName }> => {
  try {
    const splitTask = task.split(':');
    const entityName: StateMachineName | undefined = splitTask[0];
    const entityTask: string | undefined = splitTask[1];
    if (!entityName || !entityTask) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - protocol string not properly defined`);
    }

    if (!isStateMachineTask(entityTask)) {
      throw new Error(`[${SeverityLevelCodes.ERROR}] - task field is malformed`);
    }

    return { entityTask, entityName };
  } catch (error) {
    console.error(error);
    return null;
  }
};

const sharedWorkerSwitch = (p: MessagePort, message: SharedWorkerMessage): void => {
  const names: Nullable<{ entityName: string; entityTask: string }> = disectTask(message.task);
  if (!names) return;
  const { entityTask, entityName } = names;

  switch (entityTask) {
    case 'check': {
      checkStatus(p, entityName, message);
      break;
    }
    case 'set': {
      const status = message.payload;
      if (isStateMachineState(status)) {
        setStatus(entityName, {
          initiator: message.id,
          entity: entityName,
          status,
        });
      }
      break;
    }
    case 'transfer': {
      p.postMessage(message);
      break;
    }
  }
};
declare const self: SharedWorkerGlobalScope;
self.addEventListener('connect', (event: MessageEvent<SharedWorkerMessage>): void => {
  const port = event.ports[0];
  if (!port) throw new Error('Port was not found');
  ports.add(port);
  port.start();
  port.addEventListener('message', (messageEvent: MessageEvent<SharedWorkerMessage>): void => {
    for (const connectedPort of ports) sharedWorkerSwitch(connectedPort, messageEvent.data);
  });
});
