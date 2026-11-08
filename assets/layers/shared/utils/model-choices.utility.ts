import { type AssistantSettings } from '@/layers/shared/models/assistant-settings.model';
import { type ModelMetadata, type SettingChoice } from '@/layers/shared/models/model-metadata.model';
import { type ModelOption } from '@/layers/shared/models/model-option.model';

export const modelChoices = (models: readonly ModelOption[]): SettingChoice[] =>
  models.map(({ id, label }) => ({ value: id, label }));

export const metadataPrecisionChoices = (
  metadata: ModelMetadata,
  execution: AssistantSettings['execution'],
): SettingChoice[] => [
  ...(metadata.precisions.includes(metadata.autoPrecision[execution])
    ? [{ value: 'auto', label: 'Auto' }]
    : []),
  ...metadata.precisions.map((value) => ({ value, label: value.toUpperCase() })),
];
