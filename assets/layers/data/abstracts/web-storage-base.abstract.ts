import { SeverityLevelCodes } from '@/layers/shared/constants';

export abstract class WebStorageBase {
  constructor(protected readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined) {}

  protected read(key: string): string | null {
    if (!this.storage) throw new Error(`[${SeverityLevelCodes.ERROR}] - Storage unavailable`);
    return this.storage.getItem(key);
  }

  protected write(key: string, value: string): void {
    if (!this.storage) throw new Error(`[${SeverityLevelCodes.ERROR}] - Storage unavailable`);
    this.storage.setItem(key, value);
  }
}
