export const lmConfigKeys = ['source', 'model', 'device', 'dtype'] as const;
import { type DataType, type DeviceType } from '@huggingface/transformers';

export const lmDevices: readonly string[] = [
  'auto',
  'gpu',
  'cpu',
  'wasm',
  'webgpu',
  'cuda',
  'dml',
  'webnn',
  'webnn-npu',
  'webnn-gpu',
  'webnn-cpu',
] as const satisfies readonly DeviceType[];

export const lmDtypes: readonly string[] = [
  'auto',
  'fp32',
  'fp16',
  'q8',
  'int8',
  'uint8',
  'q4',
  'bnb4',
  'q4f16',
] as const satisfies readonly DataType[];
