export type Listener<T> = (data: T) => void;
export type Unsubscribeable = () => void;
export type ReadonlyConnections<T> = {
  connect: (listener: Listener<T>) => () => void;
};

export type WritableConnections<T> = ReadonlyConnections<T> & {
  emit: (data: T) => void;
  disconnect: () => void;
};

export type ReadonlyStatefulConnections<T> = ReadonlyConnections<T> & {
  getValue: () => T | undefined;
};

export type WritableStatefulConnections<T> = ReadonlyStatefulConnections<T> & {
  emit: (data: T) => void;
  disconnect: () => void;
};

export const createSubscribable = <T>(): WritableConnections<T> => {
  const listeners = new Set<Listener<T>>();

  const connect = (listener: Listener<T>): Unsubscribeable => {
    listeners.add(listener);
    return (): void => {
      listeners.delete(listener);
    };
  };

  return {
    connect,
    emit: (data: T): void => {
      for (const listener of listeners) {
        listener(data);
      }
    },
    disconnect: (): void => {
      listeners.clear();
    },
  };
};

export const createStatefulSubscribable = <T>(initialValue?: T): WritableStatefulConnections<T> => {
  const listeners = new Set<Listener<T>>();
  let currentValue = initialValue;
  let hasValue = initialValue ? true : false;

  const connect = (listener: Listener<T>): (() => void) => {
    listeners.add(listener);

    if (hasValue) {
      listener(currentValue as T);
    }
    return () => {
      listeners.delete(listener);
    };
  };

  const emit = (data: T): void => {
    currentValue = data;
    hasValue = true;

    for (const listener of listeners) {
      listener(data);
    }
  };

  return {
    connect,
    emit,
    disconnect: (): void => {
      listeners.clear();
    },
    getValue: (): T | undefined => currentValue,
  };
};
