import { ApiContract } from '../../shared/contracts/api.contract';

//TODO:// Need to convert to abstract but its used by implementation
export class ApiBase implements ApiContract {
  //@ts-ignore
  constructor(private baseURL: string) {}

  loadUint8Array = async (
    url: string = '/content-data/contents.bin',
  ): Promise<Uint8Array<ArrayBufferLike> | undefined> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    const arrayBuffer = await response.bytes();
    if (arrayBuffer instanceof Uint8Array) return arrayBuffer;
    console.error('Expected return data to be a Uint8Array');
  };
  // TODO: Fix hardcoded adres	// TODO: Fix hardcoded adresss
  loadJSON = async <T>(url: string = '/content-data/vector-metadata.json'): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    return await response.json();
  };
}
