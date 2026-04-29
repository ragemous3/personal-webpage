import { ProgressInfo } from '@huggingface/transformers';
import { LlmDTO, MessageBase } from './models';
import { LocalLLMData } from '../llm.data';
import { SeverityLevelCodes } from '../../shared/constants';
import { Nullable } from '../../shared/models';

const localLLM = new LocalLLMData();
let ID = ''; //defined from outside
let NAME: string | undefined = ''; //defined from outside
//TODO: progressTracker is a dupe from vectordb hnd also the text llm:progress is hardcoded

const progressTracker = (progress: ProgressInfo, entity: string = 'llm') => {
  //TODO: add Response to the end
  postMessage({ id: ID, name: NAME, task: `${entity}:progress`, payload: progress });
};

const isLlmDto = (dto: unknown | Nullable<LlmDTO>): dto is LlmDTO =>
  typeof dto === 'object' && dto !== null && 'message' in dto ? true : false;

const handleChatQuery = async (llmDto: LlmDTO | unknown) => {
  if (!isLlmDto(llmDto))
    throw new Error(`$[${SeverityLevelCodes.ERROR}] - Expected a properly defined dto.`);
  const { message } = llmDto;
  if (!message.length)
    throw new Error(
      `$[${SeverityLevelCodes.ERROR}] - Expected chat message array to be populated.`,
    );

  const final = await localLLM.chatMessageHandler(message, async (txt: string) =>
    postMessage({ id: ID, name: NAME, task: 'llm:stream:response', payload: txt }),
  );
  postMessage({ id: ID, name: NAME, task: 'llm:message:response', payload: final });
};

onmessage = async (msgEvent: MessageEvent<MessageBase<LlmDTO | unknown>>) => {
  const { id, task, payload, name }: MessageBase<LlmDTO | unknown> = msgEvent.data;
  ID = id;
  NAME = name;
  try {
    if (task === 'llm:init') {
      await localLLM.init(progressTracker);
      postMessage({ id: ID, name: NAME, task: 'llm:ready', payload: null });
      return;
    }

    if (payload && task === 'llm:query') handleChatQuery(payload);
  } catch (err) {
    if (err instanceof Error) {
      postMessage({
        ...msgEvent.data,
        error: {
          name: `${err.name}`,
          message: err.message,
          stack: err.stack,
        },
      });

      return;
    }
    postMessage({
      ...msgEvent.data,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(err),
        stack: null,
      },
    });
  }
};

//
