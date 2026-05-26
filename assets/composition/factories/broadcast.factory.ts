import { Broadcast } from '@/layers/data/broadcast.data';
import { type MessageBase } from '@/layers/data/workers/models';
import { type BroadcastContract } from '@/layers/shared/contracts/broadcast-port.contract';

const broadcast = new Map<string, BroadcastContract<MessageBase<unknown>, MessageBase<unknown>>>();

export const getOrCreateBroadcast = (
  name: string,
  getSender = false, //The getSender will also prohibit the sender object from recieing any messages
): BroadcastContract<MessageBase<unknown>, MessageBase<unknown>> => {
  const existing = broadcast.get(name);
  if (existing && getSender) {
    return existing;
  }
  if (getSender) {
    const port = new Broadcast<MessageBase<unknown>, MessageBase<unknown>>(name);
    broadcast.set(name, port);
    return port;
  }
  return new Broadcast<MessageBase<unknown>, MessageBase<unknown>>(name);
};
