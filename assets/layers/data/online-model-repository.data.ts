import { type OnlineModelRepositoryContract } from '@/layers/shared/contracts/online-model-repository.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { type OnlineModel } from '@/layers/shared/models/online-model.model';

const validTokenLimit = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1024;

const isOnlineModel = (value: unknown): value is OnlineModel => isRecord(value) &&
  typeof value.id === 'string' && /^[\w.-]+$/.test(value.id) &&
  typeof value.label === 'string' && value.reasoningEffort === 'low' &&
  validTokenLimit(value.maxOutputTokens);

export class OnlineModelRepository implements OnlineModelRepositoryContract {
  constructor(private readonly request: typeof fetch = (input, init) => fetch(input, init)) {}

  async load(): Promise<OnlineModel[]> {
    const response = await this.request('/api/models', { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (!response.ok) throw new Error('Online model options are unavailable.');
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.models) || body.models.length === 0 || !body.models.every(isOnlineModel))
      throw new Error('Invalid online model options.');
    return body.models;
  }
}
