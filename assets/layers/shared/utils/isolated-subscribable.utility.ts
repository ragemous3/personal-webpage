import {
  createSubscribable,
  type Listener,
  type WritableConnections,
} from '@/layers/shared/utils/subscribable';

export const createIsolatedSubscribable = <T>(): WritableConnections<T> => {
  const events = createSubscribable<T>();
  return {
    ...events,
    connect: (listener: Listener<T>): (() => void) =>
      events.connect((event) => {
        try {
          listener(event);
        } catch {
          /* Optional presentation observers cannot fail generation. */
        }
      }),
  };
};
