import { type SiteConfigurationGlobal } from '@/composition/models/models';

export const isSiteConfiguratonGlobal = (
  siteConfig: unknown,
): siteConfig is SiteConfigurationGlobal =>
  siteConfig &&
  typeof siteConfig === 'object' &&
  'SITE_PARAMS' in siteConfig &&
  'PAGE_PARAMS' in siteConfig &&
  'WORKER_NAMES' in siteConfig
    ? true
    : false;
