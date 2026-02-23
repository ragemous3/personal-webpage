import { loadHnswlib } from 'hnswlib-wasm';
import { ChunkTextByToken } from './tokenizer';
import { pipeline } from '@huggingface/transformers';
import rawData from '../../static/content-data/index.json?url';

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

const getChunks = async (
  data,
  chunkSettings = {
    minChars: 100,
    maxChars: 300,
    overlap: 40,
  },
) => {
  let chunkGroups = [];

  try {
    for (const [i, rawData] of data.entries()) {
      const chunks = await tokenizer
        .createChunksRecursiveTextSplitterAsync(
          rawData.content,
          i,
          chunkSettings,
        )
        .catch((e) => console.error(e));

      if (chunks && chunks.length) {
        chunkGroups = [...chunkGroups, ...chunks];
      } else {
        console.error('Expected chunks but array was empty!');
      }
    }
  } catch (e) {
    console.error(e);
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
  const lib = await loadHnswlib();

  const dim = 384;
  const index = new lib.HierarchicalNSW('cosine', dim, fileName);
  const nodeConnections = 16;
  const efConstructor = 200;
  const seedGen = 100;
  const maxEls = vectorColl.length;

  index.initIndex(maxEls, nodeConnections, efConstructor, seedGen);

  try {
    vectorColl.forEach((vec, i) => {
      index.addPoint(vec, i, false);
    });
  } catch (error) {
    console.error(error);
  }

  index.writeIndex(fileName);
};

function downloadAsFile(data, fileName, type = 'application/json') {
  const blob = new Blob([data], {
    type,
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const makeDBDownloadable = () => {
  const DB_NAME = '/hnswlib-index';
  const STORE_NAME = 'FILE_DATA';

  const HNSW_LIB_STORE = '/hnswlib-index';
  const ENTRY_KEY = `${HNSW_LIB_STORE}/${fileName}`;

  document.getElementById('download').addEventListener('click', () => {
    const openRequest = indexedDB.open(DB_NAME);

    openRequest.onerror = () => console.error('Failed to open IndexedDB');

    openRequest.onsuccess = () => {
      const db = openRequest.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(ENTRY_KEY);

      getRequest.onerror = () => console.error('Failed to read entry');

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
        downloadAsFile(
          data.contents,
          'contents.bin',
          'application/octet-stream',
        );
      };
    };
  });
};

const makeChunksDownloadAble = (chunks) => {
  document
    .getElementById('download-chunks')
    .addEventListener('click', () =>
      downloadAsFile(JSON.stringify(chunks, null, 2), 'chunks.json'),
    );
};

makeDBDownloadable();
const collections = await getVectorCollAndChunkGroups();
makeChunksDownloadAble(collections.chunkGroups);
await initHNSW(collections.vectors);
