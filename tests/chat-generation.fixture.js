import { Chat } from '@/layers/data/local-chat-lm.data';

export const createChatGenerationFixture = (ready = false) => {
  const listeners = new Set();
  const sent = [];
  const initialized = [];
  const released = [];
  const chat = new Chat(
    {
      onData(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      host(message) {
        initialized.push(message);
      },
      send(message) {
        sent.push({
          payload: message.payload,
          requestId: message.requestId,
          action: message.task.endsWith(':cancel') ? 'cancel' : 'query',
        });
      },
      release(...arguments_) {
        released.push(arguments_);
      },
    },
    { name: 'llm', payload: {} },
    false,
  );
  const emit = (message) => {
    for (const listener of listeners)
      listener({ id: chat.channelId, name: 'llm', payload: null, ...message });
  };
  let subscriptions = 0;
  const connect = chat.stateSubscription.connect;
  chat.stateSubscription.connect = (listener) => {
    subscriptions++;
    const disconnect = connect(listener);
    let active = true;
    return () => {
      if (active) {
        active = false;
        subscriptions--;
        disconnect();
      }
    };
  };
  Object.assign(chat, { sent, initialized, released, emit });
  Object.defineProperty(chat, 'listeners', { get: () => subscriptions });
  if (ready) emit({ task: 'llm:ready' });
  return chat;
};
