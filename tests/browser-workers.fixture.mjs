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

class WorkerPort {
  listeners = new Map();

  start() {}
  close() {}

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  postMessage(message) {
    for (const listener of this.listeners.get('message') ?? []) {
      listener({
        data: {
          ...message,
          payload: {
            entity: message.name,
            initiator: message.id,
            status: 'UNINITIALIZED',
          },
        },
      });
    }
  }
}

class BrowserSharedWorker {
  port = new WorkerPort();

  constructor() {
    resources.push(this);
  }
}

class BrowserWorker {
  messages = [];

  constructor(source) {
    this.source = source;
    resources.push(this);
    workers.push(this);
  }

  postMessage(message) {
    this.messages.push(message);
    if (message.task === 'hub:ping') {
      this.onmessage?.({ data: message });
    }
  }

  terminate() {}
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
  Worker: BrowserWorker,
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
    'state-machine.shared-worker.ts': '/workers/state-machine.js',
    'hub.worker.ts': '/workers/hub.js',
    'llm.worker.ts': '/workers/llm.js',
    'vectordb.worker.ts': '/workers/vectordb.js',
  },
});
