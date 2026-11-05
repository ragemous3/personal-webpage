import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ApiContract } from '@/layers/shared/contracts/api.contract';
import { type ModelMetadataRepositoryContract } from '@/layers/shared/contracts/model-metadata-repository.contract';
import { isRecord } from '@/layers/shared/guards/guards';
import {
  type ModelDescriptor,
  type ModelMetadata,
  type ModelPrecision,
  modelPrecisionSuffixes,
} from '@/layers/shared/models/model-metadata.model';

interface MetadataSources {
  cache?: CacheStorage | undefined;
  modelBaseUrl?: string | undefined;
  metadataBaseUrl?: string | undefined;
}

const precision = (value: unknown): value is ModelPrecision =>
  typeof value === 'string' && Object.hasOwn(modelPrecisionSuffixes, value);

const manifest = (value: unknown, revision: string): string[] => {
  if (!isRecord(value) || value.sha !== revision || !Array.isArray(value.siblings))
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Model metadata revision does not match`);
  return value.siblings.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.rfilename === 'string' ? [entry.rfilename] : [],
  );
};

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
const autoPrecisions = (value: unknown): ModelMetadata['autoPrecision'] => {
  const custom = record(record(value)['transformers.js_config']);
  const devices = record(custom.device_config);
  const result: ModelMetadata['autoPrecision'] = { auto: 'fp32', wasm: 'q8', webgpu: 'fp32' };
  for (const device of ['auto', 'wasm', 'webgpu'] as const) {
    const configured = record(devices[device]).dtype ?? custom.dtype;
    const dtype = isRecord(configured) ? configured.model : configured;
    if (precision(dtype)) result[device] = dtype;
  }
  return result;
};
const validAuto = (value: unknown): boolean => {
  const mapping = record(value);
  return ['auto', 'wasm', 'webgpu'].every((key) => precision(mapping[key]));
};
const cachedMetadata = (value: unknown, model: ModelDescriptor): value is ModelMetadata => {
  if (!isRecord(value) || value.model !== model.id || value.revision !== model.revision)
    return false;
  const variants = value.precisions;
  return (
    Array.isArray(variants) &&
    variants.length > 0 &&
    variants.every(precision) &&
    validAuto(value.autoPrecision)
  );
};

export class ModelMetadataRepository implements ModelMetadataRepositoryContract {
  readonly #pending = new Map<string, Promise<ModelMetadata>>();
  readonly #memory = new Map<string, ModelMetadata>();
  readonly #modelBase: string;
  readonly #metadataBase: string;

  constructor(
    private readonly api: Pick<ApiContract, 'loadJSON'>,
    readonly models: readonly ModelDescriptor[],
    private readonly sources: MetadataSources = {},
  ) {
    this.#modelBase = (sources.modelBaseUrl ?? 'https://huggingface.co/').replace(/\/?$/, '/');
    this.#metadataBase = (sources.metadataBaseUrl ?? 'https://huggingface.co/api/models/').replace(
      /\/?$/,
      '/',
    );
    if (models.length === 0 || models.some((model) => !/^[a-f\d]{40}$/.test(model.revision)))
      throw new Error(`[${SeverityLevelCodes.ERROR}] - A pinned model revision is required`);
    if (sources.modelBaseUrl && !sources.metadataBaseUrl)
      throw new Error(
        `[${SeverityLevelCodes.ERROR}] - A model mirror requires its metadata source`,
      );
  }

  load(model: string, refresh = false): Promise<ModelMetadata> {
    const descriptor = this.models.find(({ id }) => id === model);
    if (!descriptor)
      return Promise.reject(new Error(`[${SeverityLevelCodes.ERROR}] - Model is not configured`));
    const key = `${this.#metadataBase}${model}/revision/${descriptor.revision}?model-source=${encodeURIComponent(this.#modelBase)}`;
    const saved = this.#memory.get(key);
    if (!refresh && saved) return Promise.resolve(saved);
    const pending = this.#pending.get(key);
    if (pending) return pending;
    const request = this.#load(descriptor, key, refresh).finally(() => this.#pending.delete(key));
    this.#pending.set(key, request);
    return request;
  }

  async #cache(): Promise<Cache | undefined> {
    try {
      return await this.sources.cache?.open('assistant-model-metadata-v1');
    } catch {
      return undefined;
    }
  }

  async #cached(
    cache: Cache | undefined,
    key: string,
    model: ModelDescriptor,
  ): Promise<ModelMetadata | undefined> {
    try {
      const response = await cache?.match(key);
      const saved: unknown = response ? await response.json() : undefined;
      return cachedMetadata(saved, model) ? saved : undefined;
    } catch {
      return undefined;
    }
  }

  async #load(model: ModelDescriptor, key: string, refresh: boolean): Promise<ModelMetadata> {
    const cache = await this.#cache();
    const saved = refresh ? undefined : await this.#cached(cache, key, model);
    const result = saved ?? (await this.#fetch(model));
    this.#memory.set(key, result);
    try {
      await cache?.put(key, Response.json(result));
    } catch {
      return result;
    }
    return result;
  }

  async #fetch(model: ModelDescriptor): Promise<ModelMetadata> {
    const signal = AbortSignal.timeout(10_000);
    const files = await this.api.loadJSON(
      `${this.#metadataBase}${model.id}/revision/${model.revision}`,
      (value) => manifest(value, model.revision),
      signal,
    );
    const config = await this.api.loadJSON(
      `${this.#modelBase}${model.id}/resolve/${model.revision}/config.json`,
      (value) => value,
      signal,
    );
    const precisions = Object.entries(modelPrecisionSuffixes).flatMap(([dtype, suffix]) =>
      files.includes(`onnx/model${suffix}.onnx`) && precision(dtype) ? [dtype] : [],
    );
    if (precisions.length === 0)
      throw new Error(`[${SeverityLevelCodes.ERROR}] - No supported model variants were published`);
    const result: ModelMetadata = {
      model: model.id,
      revision: model.revision,
      precisions,
      autoPrecision: autoPrecisions(config),
    };
    return result;
  }
}
