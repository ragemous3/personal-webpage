import type { StandardCommunicationBaseContract } from './base-port.contract';

export type StandardCommunicationContract<TMessage = unknown> =
  StandardCommunicationBaseContract<TMessage>;
