import { type ProgressInfo } from '@huggingface/transformers';

import { SeverityLevelCodes } from '../../shared/constants';
import { type Nullable } from '../../shared/models';
import { LocalLLMData } from '../llm.data';
import { type LlmDTO, type MessageBase } from './models';
import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';

const localLLM: LocalLLMData = undefined;
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
  if (message.length === 0)
    throw new Error(
      `$[${SeverityLevelCodes.ERROR}] - Expected chat message array to be populated.`,
    );

  const final = await localLLM.chatMessageHandler(message, async (txt: string) => {
    postMessage({ id: ID, name: NAME, task: 'llm:stream:response', payload: txt });
  });
  postMessage({ id: ID, name: NAME, task: 'llm:message:response', payload: final });
};

onmessage = async (messageEvent: MessageEvent<MessageBase<LlmDTO | unknown>>) => {
  const { id, task, payload, name }: MessageBase<LlmDTO | unknown> = messageEvent.data;
  ID = id;
  NAME = name;
  try {
    if (task === 'llm:init' && isLmConfig(payload)) {
      localLLM.init();
      await localLLM.init(progressTracker);
      postMessage({ id: ID, name: NAME, task: 'llm:ready', payload });
      return;
    }

    if (payload && task === 'llm:query') handleChatQuery(payload);
  } catch (error) {
    if (error instanceof Error) {
      postMessage({
        ...messageEvent.data,
        error: {
          name: `${error.name}`,
          message: error.message,
          stack: error.stack,
        },
      });

      return;
    }
    postMessage({
      ...messageEvent.data,
      error: {
        name: `[${SeverityLevelCodes.CRITICAL}] - Unexpected Error`,
        message: String(error),
        stack: null,
      },
    });
  }
};

//
