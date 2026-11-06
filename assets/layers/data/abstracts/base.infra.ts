import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type ApiContract } from '@/layers/shared/contracts/api.contract';

//TODO: Might Need to convert to abstract but its used by implementation
export class ApiBase implements ApiContract {
  constructor(
    readonly baseURL: string,
    private readonly fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}

  //TODO:  Need to remove the file paths and put it in SITE_PARAMS
  loadUint8Array = async (url = '/content-data/contents.bin'): Promise<Uint8Array | undefined> => {
    const response = await this.request(url);
    if (!response.ok) throw new Error(`[${SeverityLevelCodes.ERROR}] - Failed to fetch file`);
    const arrayBuffer = await response.bytes();
    if (arrayBuffer instanceof Uint8Array) return arrayBuffer;
    console.error(`[${SeverityLevelCodes.ERROR}] - Expected return data to be a Uint8Array`);
  };
  loadJSON = async <T>(
    url: string,
    parse: (data: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> => {
    const response = await this.request(url, signal ? { signal } : undefined);
    if (!response.ok) throw new Error(`[${SeverityLevelCodes.ERROR}] - Failed to fetch file`);
    const data: unknown = await response.json();

    return parse(data);
  };
  protected request(url: string, init?: RequestInit): Promise<Response> {
    const base = new URL(
      this.baseURL,
      'location' in globalThis ? globalThis.location.href : 'http://localhost/',
    );
    return this.fetcher(new URL(url, base).href, init);
  }
}
