export interface ConfigurationRecord {
  value?: unknown;
  notice?: string;
}

export interface ConfigurationRepositoryContract {
  load(): ConfigurationRecord;
  save(value: unknown): { notice?: string };
  observe(listener: (record: ConfigurationRecord) => void): () => void;
}
