/// <reference lib="webworker" />
import { SeverityLevelCodes } from '../../shared/constants';
import { Nullable } from '../../shared/models';
import { StateMachineStatesEnum } from '../contants/constants';
import {
  StateMachineName,
  StateMachineProtocol,
  StateMachineStatusLog,
  StateMachineTask,
  SharedWorkerMessage,
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
const checkStatus = (p: MessagePort, entityName: StateMachineName, msg: SharedWorkerMessage) =>
  processStatusTracker.get(entityName)
    ? p.postMessage({
        ...msg,
        payload: processStatusTracker.get(entityName),
      })
    : setStatus(entityName, {
        initiator: msg.id,
        entity: entityName,
        status: StateMachineStatesEnum.BUSY,
      }) &&
      p.postMessage({
        ...msg,
        payload: {
          initiator: msg.id,
          entity: entityName,
          status: StateMachineStatesEnum.UNINITIALIZED,
        },
      });

const isStateMachineTask = (task: string | undefined): task is StateMachineTask =>
  (task && 'check' === task) || 'transfer' === task || 'set' === task ? true : false;

const isStateMachineState = (state: unknown): state is StateMachineStatesEnum =>
  state &&
  typeof state === 'string' &&
  (StateMachineStatesEnum.BUSY === state || StateMachineStatesEnum.UNINITIALIZED === state)
    ? true
    : false;

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
  } catch (e) {
    console.error(e);
    return null;
  }
};

const sharedWorkerSwitch = (p: MessagePort, msg: SharedWorkerMessage): void => {
  const names: Nullable<{ entityName: string; entityTask: string }> = disectTask(msg.task);
  if (!names) return;
  const { entityTask, entityName } = names;

  switch (entityTask) {
    case 'check':
      checkStatus(p, entityName, msg);
      break;
    case 'set':
      const status = msg.payload;
      if (isStateMachineState(status)) {
        setStatus(entityName, {
          initiator: msg.id,
          entity: entityName,
          status,
        });
      }
      break;
    case 'transfer':
      p.postMessage(msg);
      break;
  }
};
declare const self: SharedWorkerGlobalScope;
self.onconnect = (event: MessageEvent<SharedWorkerMessage>): void => {
  const port = event.ports[0];
  if (!port) throw new Error('Port was not found');
  ports.add(port);
  port.start();
  port.onmessage = (e) => {
    ports.forEach((p) => sharedWorkerSwitch(p, e.data));
  };
};
