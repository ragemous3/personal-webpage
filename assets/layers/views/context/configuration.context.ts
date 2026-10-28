import { createContext } from '@lit/context';

import { type ConfigurationServiceContract } from '@/layers/shared/contracts/configuration-service.contract';

export const configurationContext = createContext<ConfigurationServiceContract>('assistant-configuration');
