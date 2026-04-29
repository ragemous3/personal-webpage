import { SysMessageConfig } from '../models/models';

export const isSysMessageConfig = (
  sysMessageConfig: unknown,
): sysMessageConfig is SysMessageConfig =>
  sysMessageConfig &&
  sysMessageConfig !== null &&
  typeof sysMessageConfig === 'object' &&
  'online' in sysMessageConfig &&
  'offline' in sysMessageConfig
    ? true
    : false;
