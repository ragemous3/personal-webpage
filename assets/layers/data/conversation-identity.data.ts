import { WebStorageBase } from '@/layers/data/abstracts/web-storage-base.abstract';

export class ConversationIdentity extends WebStorageBase {
  static readonly #key = 'assistant-conversation-id';

  getId(navigationType: string | undefined): string {
    try {
      const previous = this.read(ConversationIdentity.#key);
      if (navigationType === 'reload' && previous && /^[a-f\d-]{36}$/.test(previous))
        return previous;
      const id = crypto.randomUUID();
      this.write(ConversationIdentity.#key, id);
      return id;
    } catch {
      return crypto.randomUUID();
    }
  }
}
