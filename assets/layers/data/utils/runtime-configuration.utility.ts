import { WorkerKeys } from '@/layers/data/contants/constants';
import { AssistantModes } from '@/layers/shared/constants/assistant.constant';
import { ActiveRuntimeStatuses,RuntimeStatuses } from '@/layers/shared/constants/runtime.constant';
import { isRecord } from '@/layers/shared/guards/guards';
import { isAssistantSettings } from '@/layers/shared/guards/is-assistant-settings.guard';
import { type AssistantSettings, type RuntimeAvailability } from '@/layers/shared/models/assistant-settings.model';

export const selectionIdentity = (selection: unknown): Pick<RuntimeAvailability, 'selectionId'> =>
  isRecord(selection) && typeof selection.selectionId === 'string'
    ? { selectionId: selection.selectionId }
    : {};

export const isEnabled = (settings: AssistantSettings): boolean =>
  settings.mode === AssistantModes.LOCAL || Boolean(settings.onlineModel);

export const readSettings = (selection: unknown): AssistantSettings | undefined =>
  isRecord(selection) && isAssistantSettings(selection.settings) ? selection.settings : undefined;

export const resourceFailure = (resources: unknown): string | undefined => {
  if (!Array.isArray(resources)) return undefined;
  const entries: unknown[] = resources;
  const failure = entries.find(
    (resource) => isRecord(resource) && resource.status === RuntimeStatuses.FAILED,
  );
  if (!isRecord(failure)) return undefined;
  return typeof failure.error === 'string' ? failure.error : 'Model configuration failed';
};

export const resourcesReady = (resources: unknown): boolean => {
  if (!Array.isArray(resources)) return false;
  const entries: unknown[] = resources;
  return entries.every(
    (resource) =>
      isRecord(resource) &&
      typeof resource.status === 'string' &&
      ActiveRuntimeStatuses.has(
        resource.status,
      ),
  );
};
export const resourceAvailability = (
  resources: unknown,
  mode: AssistantSettings['mode'],
): { ready: boolean; loading: boolean; error?: string } => {
  const required = Array.isArray(resources)
    ? resources.filter(
        (resource: unknown) =>
          isRecord(resource) &&
          (mode === AssistantModes.LOCAL || resource.role === WorkerKeys.VECTORDB),
      )
    : resources;
  const error = resourceFailure(required);
  const ready = resourcesReady(required);
  return { ready, loading: !ready && !error, ...(error ? { error } : {}) };
};

export const sharedRevision = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined;
  const resources: unknown[] = value;
  const model = resources.find((entry) => isRecord(entry) && entry.role === WorkerKeys.LLM);
  return isRecord(model) && typeof model.revision === 'string' ? model.revision : undefined;
};
