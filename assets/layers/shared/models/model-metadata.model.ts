export const modelPrecisionSuffixes = {
  fp32: '',
  fp16: '_fp16',
  q8: '_quantized',
  int8: '_int8',
  uint8: '_uint8',
  q4: '_q4',
  bnb4: '_bnb4',
  q4f16: '_q4f16',
} as const;

export type ModelPrecision = keyof typeof modelPrecisionSuffixes;

export interface ModelDescriptor {
  id: string;
  label: string;
  revision: string;
  precision: ModelPrecision | 'auto';
}

export interface ModelMetadata {
  model: string;
  revision: string;
  precisions: ModelPrecision[];
  autoPrecision: Record<'auto' | 'wasm' | 'webgpu', ModelPrecision>;
}

export interface SettingChoice {
  value: string;
  label: string;
}
