import { Broadcast } from '../../layers/data/broadcast.data';
import { MessageBase } from '../../layers/data/workers/models';
import { BroadcastContract } from '../../layers/shared/contracts/broadcast-port.contract';

const broadcast = new Map<string, BroadcastContract<any, any>>();

export const getOrCreateBroadcast = <To extends MessageBase<unknown>, From>(
  name: string,
  getSender = false, //The getSender will also prohibit the sender object from recieing any messages
): BroadcastContract<To, From> => {
  const existing = broadcast.get(name);
  if (existing && getSender) {
    return existing;
  } else if (getSender) {
    const port = new Broadcast<To, From>(name);
    broadcast.set(name, port);
    return port;
  }
  return new Broadcast<To, From>(name);
};
