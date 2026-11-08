import { SeverityLevelCodes } from '@/layers/shared/constants';
import { isRecord } from '@/layers/shared/guards/guards';
import {
  type ModelDescriptor,
  type ModelMetadata,
  type ModelPrecision,
  modelPrecisionSuffixes,
} from '@/layers/shared/models/model-metadata.model';

const precision = (value: unknown): value is ModelPrecision =>
  typeof value === 'string' && Object.hasOwn(modelPrecisionSuffixes, value);

export const manifest = (value: unknown, revision: string): string[] => {
  if (!isRecord(value) || value.sha !== revision || !Array.isArray(value.siblings))
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Model metadata revision does not match`);
  return value.siblings.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.rfilename === 'string' ? [entry.rfilename] : [],
  );
};

const record = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});
export const autoPrecisions = (value: unknown): ModelMetadata['autoPrecision'] => {
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
export const cachedMetadata = (value: unknown, model: ModelDescriptor): value is ModelMetadata => {
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
