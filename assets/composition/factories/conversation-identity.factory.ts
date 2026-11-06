export const getConversationId = (
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  navigationType: string | undefined,
): string => {
  const key = 'assistant-conversation-id';
  try {
    const previous = storage?.getItem(key);
    if (navigationType === 'reload' && previous && /^[a-f\d-]{36}$/.test(previous)) return previous;
    const id = crypto.randomUUID();
    storage?.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
};
