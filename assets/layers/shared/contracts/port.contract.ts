import type { StandardCommunicationBaseContract } from './base-port.contract';

export interface StandardCommunicationContract<
  TMessage = unknown,
> extends StandardCommunicationBaseContract<TMessage> {}
