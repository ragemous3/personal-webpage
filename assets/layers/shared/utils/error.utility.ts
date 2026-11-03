export const describeFailure = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);
  return error.cause === undefined
    ? error.message
    : `${error.message}: ${describeFailure(error.cause)}`;
};
