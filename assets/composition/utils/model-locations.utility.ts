export const modelLocations = (
  value: Record<string, unknown>,
): { modelBaseUrl?: string; wasmBaseUrl?: string } => ({
  ...(typeof value.modelbaseurl === 'string' ? { modelBaseUrl: value.modelbaseurl } : {}),
  ...(typeof value.wasmbaseurl === 'string' ? { wasmBaseUrl: value.wasmbaseurl } : {}),
});
