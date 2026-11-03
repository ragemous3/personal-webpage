import { RuntimeCoordinatorAbstract } from '@/layers/data/abstracts/runtime-coordinator.abstract';
import { type RuntimeCoordinatorConnection } from '@/layers/data/runtime-coordinator.connection';

export class RuntimeCoordinator extends RuntimeCoordinatorAbstract {
  constructor(connection: RuntimeCoordinatorConnection) {
    super(connection);
    this.initialize();
  }
}
