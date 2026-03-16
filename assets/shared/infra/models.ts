export type Workers<T extends string> = Record<T, string>;

export type InfraConfigurationDTO<T extends string> = {
  workerMap: Workers<T>;
};
