import { SeverityLevelCodes } from '../../../shared/constants';
import { VectorDBWorkerData } from '../models/models';
import { VectorDBHNSW } from '../services/vectordbHNSW.service';

const db = new VectorDBHNSW();

onmessage = async (
  messageEvent: MessageEvent<VectorDBWorkerData>,
): Promise<void> => {
  const { task, query } = messageEvent.data;

  if (task == 'init') {
    await db.init();
  }

  if (task == 'query') {
    const resp = await db.query(query);

    postMessage(
      resp ? resp : `[${SeverityLevelCodes.ERROR}] - Expected defined value'`,
    );
  }
};
