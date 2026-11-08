import { type ChatMessage } from '@/layers/data/models/models';
import { SeverityLevelCodes } from '@/layers/shared/constants';
import { isRecord } from '@/layers/shared/guards/guards';

export const parseMessages = (value: unknown): ChatMessage[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error(`[${SeverityLevelCodes.ERROR}] - Saved conversation is invalid.`);
  return value.map((message: unknown) => {
    if (
      !isRecord(message) ||
      !['user', 'assistant'].includes(String(message.role)) ||
      typeof message.content !== 'string'
    )
      throw new Error(`[${SeverityLevelCodes.ERROR}] - Saved conversation is invalid.`);
    return {
      role: message.role as 'user' | 'assistant',
      content: message.content,
      ...(message.interrupted === true ? { interrupted: true } : {}),
    };
  });
};
