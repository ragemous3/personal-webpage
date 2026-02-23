export class ApiBase {
  constructor() {}

  loadUint8Array = async (
    url: string = '/content-data/contents.bin',
  ): Promise<Uint8Array<ArrayBufferLike> | undefined> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    const arrayBuffer = await response.bytes();
    if (arrayBuffer instanceof Uint8Array) return arrayBuffer;
    console.error('Expected return data to be a Uint8Array');
  };

  loadJSON = async <T>(
    url: string = '/content-data/vector-metadata.json',
  ): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    return await response.json();
  };
}
