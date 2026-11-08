export const tryReadBrowserValue = <T>(get: () => T): T | undefined => {
  try {
    return get();
  } catch {
    return undefined;
  }
};
