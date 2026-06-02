import {
  type DataType,
  type DeviceType,
  pipeline,
  type ProgressInfo,
  type TextGenerationPipeline,
} from '@huggingface/transformers';

import { isLmConfig } from '@/layers/data/guards/is-lm-config.guard';
import { type LocalLLMData } from '@/layers/data/llm.data';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { type Nullable } from '@/layers/shared/models';
import { TokenizerUtility } from '@/layers/shared/utils/tokenizer';

import { type LlmDTO, type MessageBase } from './models';

let localLLM: LocalLLMData | undefined;
let ID = ''; //defined from outside
let NAME: string | undefined = ''; //defined from outside
//TODO: progressTracker is a dupe from vectordb hnd also the text llm:progress is hardcoded

const loadGeneratorPipeline = async (
  modelName: string,
  defaultDevice: DeviceType,
  defaultDataType: DataType = 'auto',
  progressTracker: (progress: ProgressInfo) => void,
): Promise<TextGenerationPipeline> => {
  return await pipeline('text-generation', modelName, {
    device: defaultDevice,
    dtype: defaultDataType,
    progress_callback: progressTracker,
  });
};

const initTokenizer = async (defaultLmModelName: string): Promise<void> => {
  const tokenizerUtility = new TokenizerUtility(this.defaultLmModelName);
  await tokenizerUtility.initTokenizer();
  return tokenizerUtility;
  //this.modelMaxTokens = this.tokenizerUtil.getMaxLength();
};

const progressTracker = (progress: ProgressInfo, entity = 'llm') => {
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
          name: error.name,
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
