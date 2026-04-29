export interface ApiContract {
  loadUint8Array(url?: string): Promise<Uint8Array<ArrayBufferLike> | undefined>;
  loadJSON<T>(url?: string): Promise<T>;
}
