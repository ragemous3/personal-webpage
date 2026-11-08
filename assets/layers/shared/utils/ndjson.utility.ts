import { SeverityLevelCodes } from '@/layers/shared/constants';
export async function* readJsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let buffer = '';
  try {
    for (let part = await reader.read(); !part.done; part = await reader.read()) {
      buffer += decoder.decode(part.value, { stream: true });
      checkBuffer(buffer);
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      yield* lines.map((line): unknown => JSON.parse(line));
    }
    buffer += decoder.decode();
    if (buffer.trim()) throw new Error(`[${SeverityLevelCodes.ERROR}] - Online response was interrupted. Retry explicitly.`);
  } finally {
    await reader.cancel().catch(Boolean);
    reader.releaseLock();
  }
}

const checkBuffer = (buffer: string): void => {
  if (buffer.length > 1_000_000) throw new Error(`[${SeverityLevelCodes.ERROR}] - Online stream event is too large.`);
};
