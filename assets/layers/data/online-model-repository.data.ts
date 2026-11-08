import { ApiBase } from '@/layers/data/abstracts/base.infra';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type OnlineModelRepositoryContract } from '@/layers/shared/contracts/online-model-repository.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import { type OnlineModel } from '@/layers/shared/models/online-model.model';

export class OnlineModelRepository extends ApiBase implements OnlineModelRepositoryContract {
  #validTokenLimit(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1024;
  }

  #isOnlineModel(value: unknown): value is OnlineModel {
    return (
      isRecord(value) &&
      typeof value.id === 'string' &&
      /^[\w.-]+$/.test(value.id) &&
      typeof value.label === 'string' &&
      value.reasoningEffort === 'low' &&
      this.#validTokenLimit(value.maxOutputTokens)
    );
  }

  async load(): Promise<OnlineModel[]> {
    const response = await this.request('models', {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!response.ok)
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Online model options are unavailable.`);
    const body: unknown = await response.json();
    if (
      !isRecord(body) ||
      !Array.isArray(body.models) ||
      body.models.length === 0 ||
      !body.models.every((value: unknown) => this.#isOnlineModel(value))
    )
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Invalid online model options.`);
    return body.models;
  }
}
