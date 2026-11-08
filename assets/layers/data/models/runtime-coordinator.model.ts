import { type RuntimeMessage, type RuntimeResourceSnapshot, type RuntimeRole, type RuntimeSelection } from '@/layers/shared/models/runtime.model';

export interface RuntimeClient {
  id: ReturnType<typeof crypto.randomUUID>;
  attached: boolean;
  port: MessagePort;
  channels: Map<RuntimeRole, Set<ReturnType<typeof crypto.randomUUID>>>;
}
export type RuntimeRequestMessage = RuntimeMessage & { requestId: string };
export interface RuntimeRequest {
  key: string;
  client: RuntimeClient;
  message: RuntimeRequestMessage;
  timer: ReturnType<typeof setTimeout>;
  cancelled: boolean;
  activityTimer: ReturnType<typeof setTimeout> | undefined;
}
export interface RuntimeResource {
  deferConfiguration?: boolean;
  role: RuntimeRole;
  status: RuntimeResourceSnapshot['status'];
  epoch: string;
  port?: MessagePort;
  instanceId?: string;
  configuration?: unknown;
  activeConfiguration?: unknown;
  error?: string;
  progress?: RuntimeMessage;
  active: RuntimeRequest | undefined;
  queue: RuntimeRequest[];
  phaseTimer: ReturnType<typeof setTimeout> | undefined;
}
export interface RuntimeLease {
  client: RuntimeClient;
  requestId: string;
  timer: ReturnType<typeof setTimeout>;
  lastMessage?: RuntimeMessage;
}
export interface RuntimeCommand {
  selection?: RuntimeSelection;
  client: RuntimeClient;
  requestId: string;
  timer: ReturnType<typeof setTimeout>;
  configurations: Partial<Record<RuntimeRole, unknown>>;
}
