import { pipeline } from '@huggingface/transformers';
import { loadHnswlib } from 'hnswlib-wasm';

import { ChunkTextByToken } from './tokenizer';

const rawData = new URL('../../static/content-data/index.json', import.meta.url).href;

const featureExtractionModel = 'Xenova/all-MiniLM-L6-v2';
const extractor = await pipeline('feature-extraction', featureExtractionModel, {
  dtype: 'uint8',
});
const tokenizer = new ChunkTextByToken(featureExtractionModel);
const fileName = 'data.dat';

const getRawData = async () => {
  try {
    const response = await fetch(rawData);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch raw data:', error);
    return null;
  }
};

const defaultChunkSettings = { minChars: 100, maxChars: 300, overlap: 40 };
const appendChunks = (chunkGroups, chunks) => {
  if (chunks && chunks.length > 0) return [...chunkGroups, ...chunks];
  console.error('Expected chunks but array was empty!');
  return chunkGroups;
};
const getChunks = async (data, chunkSettings = defaultChunkSettings) => {
  let chunkGroups = [];

  try {
    for (const [index, rawData] of data.entries()) {
      const chunks = await tokenizer
        .createChunksRecursiveTextSplitterAsync(rawData.content, index, chunkSettings)
        .catch((error) => console.error(error));

      chunkGroups = appendChunks(chunkGroups, chunks);
    }
  } catch (error) {
    console.error(error);
  }
  return chunkGroups;
};

const getVectorCollAndChunkGroups = async () => {
  const data = await getRawData();

  await tokenizer.initAutoTokenizer();

  const chunkGroups = await getChunks(data);

  const vectors = await Promise.all(
    chunkGroups.map(
      async (chunk) =>
        await extractor(chunk.text, {
          pooling: 'mean',
          normalize: true,
        })
          .then((result) => result.data)
          .catch(console.error),
    ),
  );
  return { chunkGroups, vectors };
};

const initHNSW = async (vectorColl) => {
  const library = await loadHnswlib();

  const dim = 384;
  const index = new library.HierarchicalNSW('cosine', dim, fileName);
  const nodeConnections = 16;
  const efConstructor = 200;
  const seedGen = 100;
  const maxEls = vectorColl.length;

  index.initIndex(maxEls, nodeConnections, efConstructor, seedGen);

  try {
    for (const [index_, vec] of vectorColl.entries()) {
      index.addPoint(vec, index_, false);
    }
  } catch (error) {
    console.error(error);
  }

  await index.writeIndex(fileName);
};

function downloadAsFile(data, fileName, type = 'application/json') {
  const blob = new Blob([data], {
    type,
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();

  a.remove();
  URL.revokeObjectURL(url);
}

const makeDBDownloadable = () => {
  const DB_NAME = '/hnswlib-index';
  const STORE_NAME = 'FILE_DATA';

  const HNSW_LIB_STORE = '/hnswlib-index';
  const ENTRY_KEY = `${HNSW_LIB_STORE}/${fileName}`;

  document.querySelector('#download').addEventListener('click', () => {
    const openRequest = indexedDB.open(DB_NAME);

    openRequest.addEventListener('error', () => console.error('Failed to open IndexedDB'));

    openRequest.onsuccess = () => {
      const database = openRequest.result;
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(ENTRY_KEY);

      getRequest.addEventListener('error', () => console.error('Failed to read entry'));

      getRequest.onsuccess = () => {
        const data = getRequest.result;

        if (!data) {
          console.error('Was expecting data!');
          return;
        }
        downloadAsFile(
          JSON.stringify({ timestamp: data.timestamp, mode: data.mode }),
          'vector-metadata.json',
        );
        downloadAsFile(data.contents, 'contents.bin', 'application/octet-stream');
      };
    };
  });
};

const makeChunksDownloadAble = (chunks) => {
  document
    .querySelector('#download-chunks')
    .addEventListener('click', () =>
      downloadAsFile(JSON.stringify(chunks, null, 2), 'chunks.json'),
    );
};

makeDBDownloadable();
const collections = await getVectorCollAndChunkGroups();
makeChunksDownloadAble(collections.chunkGroups);
await initHNSW(collections.vectors);
globalThis.indexReady = true;
