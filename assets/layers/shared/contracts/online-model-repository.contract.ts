import { type OnlineModel } from '@/layers/shared/models/online-model.model';

export interface OnlineModelRepositoryContract {
  load(): Promise<OnlineModel[]>;
}
