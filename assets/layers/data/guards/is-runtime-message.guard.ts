import { isMessageBase, isTask, isTaskResponse } from '@/layers/data/guards/is-message-base.guard';
import { type RuntimeMessage } from '@/layers/shared/models/runtime.model';

export const isRuntimeMessage = (value: unknown): value is RuntimeMessage =>
  isMessageBase(
    value,
    (_payload): _payload is unknown => true,
    (task): task is RuntimeMessage['task'] => isTask(task) || isTaskResponse(task),
  );
