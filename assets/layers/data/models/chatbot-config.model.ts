import {
  type DataType,
  type DeviceType,
  type TextGenerationConfig,
} from '@huggingface/transformers';
import { type SpaceName } from 'hnswlib-wasm/dist/hnswlib-wasm';

export interface InitConfigBase {
  source: string;
}

export interface DatabaseConfig extends InitConfigBase {
  baseUrl: string;
  featureExtractionModel: string;
  vectorsPath: string;
  metadataPath: string;
  indexStoreName: string; // /hnswlib-index
  indexEntry: string;
  dim: number;
  nodeConnections: number;
  maxEls: number;
  efConstructor: number;
  seedGen: number;
  spaceName: SpaceName;
}

export interface LmConfig extends InitConfigBase {
  model: string;
  device: DeviceType;
  dtype: DataType;
  generation: Partial<TextGenerationConfig>;
}
