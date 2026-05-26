import {
  databaseNumberKeys,
  databaseStringKeys,
} from '@/layers/data/contants/local-database.constants';
import { type DatabaseConfig } from '@/layers/data/models/chatbot-config.model';
import { hasNumberProperties, hasStringProperties, isRecord } from '@/layers/shared/guards/guards';

export const isDatabaseConfig = (value: unknown): value is DatabaseConfig => {
  if (!isRecord(value)) return false;

  return (
    hasStringProperties(value, databaseStringKeys) && hasNumberProperties(value, databaseNumberKeys)
  );
};
