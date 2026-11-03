import { after, before } from 'node:test';

export const modelConfig = {
  source: '/workers/llm.js',
  model: 'Xenova/Qwen1.5-0.5B-Chat',
  device: 'webgpu',
  dtype: 'q4',
  generation: {},
};

export const databaseConfig = {
  source: '/workers/vectordb.js',
  baseUrl: '/',
  device: 'webgpu',
  featureExtractionModel: 'Xenova/all-MiniLM-L6-v2',
  vectorsPath: '/content-data/contents.bin',
  metadataPath: '/content-data/vector-metadata.json',
  indexStoreName: '/hnswlib-index',
  indexEntry: 'data.dat',
  dim: 384,
  nodeConnections: 16,
  maxEls: 29,
  efConstructor: 200,
  seedGen: 100,
  spaceName: 'cosine',
};

export const resources = [];
export const workers = [];

class WorkerPort extends EventTarget {
  constructor(worker) {
    super();
    this.worker = worker;
  }
  start() {
    if (this.worker.options.name === 'RuntimeCoordinator') return;
    this.dispatchEvent(
      new MessageEvent('message', {
        data: {
          id: crypto.randomUUID(),
          name: 'llm',
          task: 'runtime:state',
          payload: { instanceId: crypto.randomUUID(), loaded: false },
        },
      }),
    );
  }
  close() {}
  postMessage(message) {
    this.worker.messages.push(message);
    if (message.task === 'runtime:attach')
      this.dispatchEvent(
        new MessageEvent('message', {
          data: {
            ...message,
            task: 'runtime:state',
            payload: { resources: [], configuring: false },
          },
        }),
      );
  }
}
class BrowserSharedWorker extends EventTarget {
  messages = [];
  constructor(source, options) {
    super();
    this.source = source;
    this.options = options;
    this.port = new WorkerPort(this);
    resources.push(this);
    workers.push(this);
  }
}

class BrowserBroadcast {
  constructor() {
    resources.push(this);
  }

  addEventListener() {}
  postMessage() {}
  close() {}
}

const browserGlobals = {
  SharedWorker: BrowserSharedWorker,
  BroadcastChannel: BrowserBroadcast,
};
const originalGlobals = new Map(
  Object.keys(browserGlobals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
);

before(() => {
  for (const [key, value] of Object.entries(browserGlobals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
});

after(() => {
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor);
    } else {
      delete globalThis[key];
    }
  }
});

export const siteConfig = () => ({
  SITE_PARAMS: {
    baseURL: '/',
    params: {
      chatbot: {
        sysmessage: {
          offline: 'Answer from the provided résumé.',
          online: 'Answer from the résumé.',
        },
        config: {
          locallm: {
            model: modelConfig.model,
            device: modelConfig.device,
            dtype: modelConfig.dtype,
          },
          localdatabase: {
            featureextractionmodel: 'Xenova/all-MiniLM-L6-v2',
            vectorspath: '/content-data/contents.bin',
            metadatapath: '/content-data/vector-metadata.json',
            indexstorename: '/hnswlib-index',
            indexentry: 'data.dat',
            dim: 384,
            nodeconnections: 16,
            maxels: 29,
            efconstructor: 200,
            seedgen: 100,
            spacename: 'cosine',
          },
        },
      },
    },
  },
  PAGE_PARAMS: {},
  WORKER_NAMES: {
    'runtime-coordinator.shared-worker.ts': '/workers/coordinator.js',
    'llm.shared-worker.ts': '/workers/llm.js',
    'vectordb.shared-worker.ts': '/workers/vectordb.js',
  },
});
