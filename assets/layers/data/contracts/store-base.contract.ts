export interface StoreContract<T> {
  openStore(storeName: string): T;
}
