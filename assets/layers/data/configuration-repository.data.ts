import { SeverityLevelCodes } from '@/layers/shared/constants';
import {
  type ConfigurationRecord,
  type ConfigurationRepositoryContract,
} from '@/layers/shared/contracts/configuration-repository.contract';

const preferencesKey = 'assistant.preferences';

export class ConfigurationRepository implements ConfigurationRepositoryContract {
  constructor(
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
    private readonly events: EventTarget,
  ) {}

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
      if (!this.storage) throw new Error(`[${SeverityLevelCodes.ERROR}] - Storage unavailable`);
      return this.#decode(this.storage.getItem(preferencesKey));
    } catch {
      return { notice: 'Storage is unavailable. Settings will not be remembered.' };
    }
  }

  save(value: unknown): { notice?: string } {
    try {
      if (!this.storage) throw new Error(`[${SeverityLevelCodes.ERROR}] - Storage unavailable`);
      this.storage.setItem(preferencesKey, JSON.stringify({ version: 1, preferences: value }));
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
        (change.key !== preferencesKey && change.key !== null) ||
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
