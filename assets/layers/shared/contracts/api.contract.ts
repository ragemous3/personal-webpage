export interface ApiContract {
  loadUint8Array(path: string): Promise<Uint8Array | undefined>;
  loadJSON<T>(path: string, parse: (data: unknown) => T): Promise<T>;
}
