import { type ApiContract } from '@/layers/shared/contracts/api.contract';

//TODO: Might Need to convert to abstract but its used by implementation
export class ApiBase implements ApiContract {
  constructor(readonly baseURL: string) {}
  //TODO:  Need to remove the file paths and put it in SITE_PARAMS
  loadUint8Array = async (url = '/content-data/contents.bin'): Promise<Uint8Array | undefined> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    const arrayBuffer = await response.bytes();
    if (arrayBuffer instanceof Uint8Array) return arrayBuffer;
    console.error('Expected return data to be a Uint8Array');
  };
  loadJSON = async <T>(url: string, parse: (data: unknown) => T): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    const data: unknown = await response.json();

    return parse(data);
  };
}
