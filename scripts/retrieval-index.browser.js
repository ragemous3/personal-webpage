import * as hnsw from '/hnsw/hnswlib.js';
import { env as environment, pipeline } from '/transformers.js';
const validateVector = (vector) => {
  if (vector.length !== 384 || !vector.every((value) => Number.isFinite(value)))
    throw new Error('Invalid real embedding');
};
try {
  environment.allowLocalModels = false;
  environment.remoteHost = `${globalThis.location.origin}/models/`;
  environment.useBrowserCache = true;
  environment.backends.onnx.wasm.wasmPaths = `${globalThis.location.origin}/lib/`;
  environment.backends.onnx.wasm.numThreads = 1;
  const response = await fetch('/chunks.json');
  const chunks = await response.json();
  const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'uint8',
    device: 'wasm',
  });
  const vectors = [];
  for (const chunk of chunks) {
    const result = await embedder(chunk.text, { pooling: 'mean', normalize: true });
    const vector = Float32Array.from(result.data);
    validateVector(vector);
    vectors.push(vector);
  }
  await hnsw.__tla;
  const library = await hnsw.loadHnswlib();
  const index = new library.HierarchicalNSW('cosine', 384, 'data.dat');
  index.initIndex(chunks.length, 16, 200, 100);
  for (const [label, v] of vectors.entries()) index.addPoint(v, label, false);
  index.setEfSearch(200);
  if (index.getCurrentCount() !== chunks.length) throw new Error('Index count mismatch');
  const selected = chunks.findIndex((c) => c.text.length > 200);
  const neighbors = index.searchKnn(vectors[selected], Math.min(5, chunks.length), () => true);
  if (
    !neighbors.neighbors.includes(selected) ||
    neighbors.neighbors.some((index_) => !chunks[index_])
  )
    throw new Error('Index label/query mismatch');
  await index.writeIndex('data.dat');
  await hnsw.syncFileSystem('write');
  const entry = await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open('/hnswlib-index');
    request.addEventListener('error', () => reject(request.error));
    request.onsuccess = () => {
      const database = request.result;
      const get = database
        .transaction('FILE_DATA', 'readonly')
        .objectStore('FILE_DATA')
        .get('/hnswlib-index/data.dat');
      get.addEventListener('error', () => reject(get.error));
      get.onsuccess = () => {
        resolve(get.result);
        database.close();
      };
    };
  });
  if (!entry?.contents?.length || Number.isNaN(new Date(entry.timestamp).getTime()))
    throw new Error('Invalid exported index');
  globalThis.result = {
    chunks,
    contents: [...entry.contents],
    metadata: { mode: entry.mode, timestamp: new Date(entry.timestamp).toISOString() },
    count: index.getCurrentCount(),
    neighbors,
    selected,
  };
} catch (error) {
  globalThis.failure = String(error);
}
