import {
  type ModelDescriptor,
  type ModelMetadata,
} from '@/layers/shared/models/model-metadata.model';

export interface ModelMetadataRepositoryContract {
  readonly models: readonly ModelDescriptor[];
  load(model: string, refresh?: boolean): Promise<ModelMetadata>;
}
