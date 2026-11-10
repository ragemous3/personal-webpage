import { type TalkingHeadState } from '@/layers/shared/models/speech.model';
import { type ReadonlyStatefulConnections } from '@/layers/shared/utils/subscribable';
export interface TalkingHeadServiceContract {
  readonly stateSubscription: ReadonlyStatefulConnections<TalkingHeadState>;
  mount(host: HTMLElement): Promise<void>;
  enable(): Promise<void>;
  stop(): void;
  dispose(): void;
}
