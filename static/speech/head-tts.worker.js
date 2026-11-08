import './headtts/modules/worker-tts.mjs';

const networkFetch = globalThis.fetch.bind(globalThis);
const isSpeechAsset = (request) => {
  const url = new URL(request.url);
  return (
    request.method === 'GET' &&
    (url.pathname.includes('/voices/') ||
      (url.origin === globalThis.location.origin && url.pathname.includes('/dictionaries/')))
  );
};
globalThis.fetch = async (input, options) => {
  const request = new Request(input, options);
  if (!isSpeechAsset(request) || !globalThis.caches) return networkFetch(request);
  let cache;
  try {
    cache = await globalThis.caches.open('assistant-speech-assets-v1');
    const cached = await cache.match(request);
    if (cached) return cached;
  } catch {
    return networkFetch(request);
  }
  const response = await networkFetch(request);
  if (response.status === 200) {
    try {
      await cache.put(request, response.clone());
    } catch {
      console.info('Speech asset caching is unavailable.');
    }
  }
  return response;
};

