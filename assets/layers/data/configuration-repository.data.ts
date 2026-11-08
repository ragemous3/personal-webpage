import { WebStorageBase } from '@/layers/data/abstracts/web-storage-base.abstract';
import {
  type ConfigurationRecord,
  type ConfigurationRepositoryContract,
} from '@/layers/shared/contracts/configuration-repository.contract';

export class ConfigurationRepository extends WebStorageBase implements ConfigurationRepositoryContract {
  static readonly #preferencesKey = 'assistant.preferences';
  constructor(
    storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
    private readonly events: EventTarget,
  ) {
    super(storage);
  }

  #decode(raw: string | null): ConfigurationRecord {
    if (raw === null) return { value: undefined };
    try {
      const record: unknown = JSON.parse(raw);
      if (
        typeof record !== 'object' ||
        record === null ||
        !('version' in record) ||
        record.version !== 1 ||
        !('preferences' in record)
      ) {
        return { notice: 'Saved settings are unsupported. Defaults restored.' };
      }
      return { value: record.preferences };
    } catch {
      return { notice: 'Saved settings are damaged. Defaults restored.' };
    }
  }

  load(): ConfigurationRecord {
    try {
      return this.#decode(this.read(ConfigurationRepository.#preferencesKey));
    } catch {
      return { notice: 'Storage is unavailable. Settings will not be remembered.' };
    }
  }

  save(value: unknown): { notice?: string } {
    try {
      this.write(ConfigurationRepository.#preferencesKey, JSON.stringify({ version: 1, preferences: value }));
      return {};
    } catch {
      return { notice: 'Settings could not be saved. Changes apply to this session only.' };
    }
  }

  observe(listener: (record: ConfigurationRecord) => void): () => void {
    let active = true;
    const receive = (event: Event): void => {
      const change = event as StorageEvent;
      if (
        !active ||
        (change.key !== ConfigurationRepository.#preferencesKey && change.key !== null) ||
        (change.storageArea && change.storageArea !== this.storage)
      )
        return;
      listener(this.load());
    };
    this.events.addEventListener('storage', receive);
    return () => {
      active = false;
      this.events.removeEventListener('storage', receive);
    };
  }
}
