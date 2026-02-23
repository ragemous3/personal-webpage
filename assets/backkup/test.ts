import {
  env,
  pipeline,
  TextGenerationOutput,
  TextGenerationPipeline,
  TextStreamer,
} from '@huggingface/transformers';
import { loadHnswlib, syncFileSystem } from 'hnswlib-wasm';

import { Chunk, GenerationConfig, HNSWDBEntry } from './models/models';
import { TokenizerUtil } from './shared/utils';

env.allowLocalModels = false;
const lib = await loadHnswlib();
const HNSW_LIB_STORE = '/hnswlib-index';
const key = `${HNSW_LIB_STORE}/data.dat`;
const url = '/content-vectors/indexdbvectors.json';
const query = 'When did he work with typescript?`';
const LLM_MODEL = 'Xenova/Qwen1.5-0.5B-Chat';

const tokenizerUtil = new TokenizerUtil(LLM_MODEL);
await tokenizerUtil.initTokenizer();
const MODEL_MAX_TOKENS = tokenizerUtil.getMaxLength();

const dim = 384;
const index = new lib.HierarchicalNSW('cosine', dim, 'data.dat');
const nodeConnections = 16;
const maxEls = 29;
const efConstructor = 200;
const seedGen = 100;
index.initIndex(maxEls, nodeConnections, efConstructor, seedGen);
await readInFile();

// 1. Init VectorDB (in a sep thread), init LLM service loadLLM (in a sep thread)
// 2. Wait for both to be completed
// 2. Input Query & Search while at the same time loading the chunks
// 3. Wait for both to finish.
// 4. Retrieve the chunks  / and maybe full data for linking later)
// 5. Retrieve full chat and recon (???)1
const exists = lib.EmscriptenFileSystemManager.checkFileExists('data.dat');
const extractor = await pipeline(
  'feature-extraction',
  'Xenova/all-MiniLM-L6-v2',
  {
    device: 'webgpu',
    dtype: 'uint8',
  },
);

const queryEmbedding = await extractor([query], {
  pooling: 'mean',
  normalize: true,
});

if (exists && lib.EmscriptenFileSystemManager.isSynced()) {
  await index.readIndex('data.dat', dim);
  index.setEfSearch(200);
}
const matches = index.searchKnn(
  <Float32Array>queryEmbedding.data,
  5,
  undefined,
);
const chunks: Chunk[] = await loadJSON('/content-data/chunks.json');
const matchedData = matches.neighbors.map((neighbor) => chunks[neighbor]);
chatWithBot(matchedData, query, LLM_MODEL);

async function readInFile() {
  await fetchAndStore(url, key);
  await syncFileSystem('read');
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('/hnswlib-index', 21);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('FILE_DATA')) {
        reject('Store should`ve been loaded earlier.');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      resolve(db);
    };
    request.onerror = () => {
      console.error(request.error);
      reject(0);
    };
  });
}
async function loadUint8Array(
  url: string = '/content-data/contents.bin',
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch file');
  const arrayBuffer = await response.bytes();
  if (arrayBuffer instanceof Uint8Array) return arrayBuffer;
  console.error('Expected return data to be a Uint8Array');
}

async function loadJSON(url: string = '/content-data/vector-metadata.json') {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch file');
  return await response.json();
}

async function fetchAndStore(url, key) {
  const db = await openDB();
  if (!db) throw new Error('Failed to init DB');
  const metadata: Omit<HNSWDBEntry, 'contents'> = await loadJSON();
  const contents: Uint8Array = await loadUint8Array();
  const data: HNSWDBEntry = {
    timestamp: new Date(metadata.timestamp),
    mode: metadata.mode,
    contents,
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction('FILE_DATA', 'readwrite');
    const index = tx.objectStore('FILE_DATA');

    index.put(data, key);

    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

async function loadModel(modelName: string): Promise<TextGenerationPipeline> {
  return await pipeline('text-generation', modelName, {
    device: 'webgpu',
    dtype: 'q4',
  });
}

async function promptModel(
  prompt: string,
  generator: TextGenerationPipeline,
  options: Partial<GenerationConfig> = {
    max_new_tokens: 128,
    do_sample: false,
    return_full_text: false,
  },
): Promise<TextGenerationOutput | TextGenerationOutput[]> {
  return await generator(prompt, options);
}

async function reScore(
  context: Chunk[],
  query: string,
  generator: TextGenerationPipeline,
) {
  const score = [];

  for (const ctx of context) {
    const prompt = `
  CONTEXT is text from a person named Rasmus resumé.
   Answer with only:
  1 = context answers the query
  0 = context does not answer the query
    QUERY:  ${query}\n
    CONTEXT: ${ctx.text}
  `;
    if ((await countTokens(prompt)) > MODEL_MAX_TOKENS) {
      console.error(
        'removed matched data because it exceeded MODEL_MAX_TOKENS',
      );
      continue;
    }
    const output = await promptModel(prompt, generator);
    const text = output[0].generated_text;

    score.push(text);
  }
  console.log(JSON.stringify(score));
  return context[
    score.reduce((acc, answer, index) => {
      const parsed = parseInt(answer);
      if (parsed > acc) {
        return parseInt(acc);
      }
      return acc;
    }, 0)
  ];
}

function getTxTPrompt(context: Chunk[], query: string) {
  return `
You are answering questions about Rasmus resumé / CV.
You must answer the QUESTION using ONLY the information found in the CONTEXT section.
RULES:
- If the answer is not explicitly stated in the CONTEXT, respond exactly with:
  "I don't have enough information in the provided documents to answer that."
CONTEXT:
${context.map((chunk) => chunk.text).join('\n')}
QUESTION:
${query}
`;
}

function getChatPrompt(context: Chunk[], query: string) {
  const chat = [
    {
      role: 'system',
      content: `You are answering questions about Rasmus resumé / CV.
RULES:
- You must answer the QUESTION using ONLY the information found in the CONTEXT section.
- If the answer is not explicitly stated in the CONTEXT, respond exactly with:
  "I don't have enough information in the provided documents to answer that."
CONTEXT:
${context.map((chunk) => chunk.text).join('\n')}`,
    },
    { role: 'user', content: 'Rasmus know Typescript?' },
    { role: 'assistant', content: 'Yes. Rasmus knows TypeScript.' },
    { role: 'user', content: query },
  ];

  const txt: unknown = tokenizerUtil.tokenizer.apply_chat_template(chat, {
    tokenize: false,
  });

  if (typeof txt === 'string') return txt;
  console.error('Expected value to be string');
}
async function summarizeChat() {
  const summarizePrompt = ``;
}
async function chatWithBot(
  context: Chunk[] | undefined,
  query: string,
  modelName: string = 'Xenova/LaMini-Flan-T5-783M',
) {
  if (!context) return;

  console.log(query);
  console.log(JSON.stringify(context, null, 2));

  const generator = await loadModel(modelName);
  const bd = document.getElementsByTagName('body')[0];

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_special_tokens: true,
    callback_function: (text) => {
      bd.textContent += text;
    },
  });

  //  prompt = await reScore(context, query, generator);
  let prompt = getChatPrompt(context, query);
  const tokenTotal = await tokenizerUtil.countTokens(prompt);
  if (tokenTotal > MODEL_MAX_TOKENS) {
    console.error(
      `TO many tokens in query! FATAL. Total amount of tokens: ${tokenTotal}`,
    );
  }

  const output = await promptModel(prompt, generator, {
    streamer,
    max_new_tokens: 100,
    temperature: 0.75,
  });

  const text = output[0].generated_text;

  console.log('Generated text:\n', text);
}
