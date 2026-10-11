import { type SysMessageConfig } from '@/composition/models/models';
import { hasStringProperties, isRecord } from '@/layers/shared/guards/guards';

export const isSysMessageConfig = (
  sysMessageConfig: unknown,
): sysMessageConfig is SysMessageConfig =>
  isRecord(sysMessageConfig) && hasStringProperties(sysMessageConfig, ['online', 'offline']);
