import { type SysMessageConfig } from '@/composition/models/models';

export const isSysMessageConfig = (
  sysMessageConfig: unknown,
): sysMessageConfig is SysMessageConfig =>
  sysMessageConfig &&
  typeof sysMessageConfig === 'object' &&
  'online' in sysMessageConfig &&
  'offline' in sysMessageConfig
    ? true
    : false;
