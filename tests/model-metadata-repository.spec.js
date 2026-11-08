import assert from 'node:assert/strict';
import test from 'node:test';

import { ModelMetadataRepository } from '@/layers/data/model-metadata-repository.data';

const revision = '340777bb38067a8a5af921a405e3206a8cc2f318';
const models = [{ id: 'Xenova/Qwen1.5-0.5B-Chat', revision, precision: 'q4', label: 'Qwen' }];
const createRepository = (fetcher, choices, sources = {}) =>
  new ModelMetadataRepository('https://example.test/', choices, sources, fetcher);

test('choices come from the selected revision and only the files used by our decoder loader', async () => {
  const requests = [];
  const repository = createRepository(async (url) => {
    requests.push(url);
    return Response.json({
      sha: revision,
      siblings: [
        { rfilename: 'onnx/model_q4.onnx' },
        { rfilename: 'onnx/model_fp16.onnx' },
        { rfilename: 'onnx/decoder_model_merged_quantized.onnx' },
      ],
    });
  }, models);
  const metadata = await repository.load(models[0].id);
  assert.deepEqual(metadata.precisions, ['fp16', 'q4']);
  assert.equal(metadata.revision, revision);
  assert.equal(
    requests[0],
    `https://huggingface.co/api/models/${models[0].id}/revision/${revision}`,
  );
});

const offline = async () => { throw new Error('Offline'); };

const memoryCache = () => {
  const entries = new Map();
  return {
    async open() {
      return {
        async match(key) {
          return entries.get(key)?.clone();
        },
        async put(key, value) {
          entries.set(key, value.clone());
        },
      };
    },
  };
};
const api =
  (files, sha = revision) =>
  async (url) =>
    Response.json(
      url.includes('/api/models/')
        ? { sha, siblings: files.map((rfilename) => ({ rfilename })) }
        : {},
    );

test('a new repository reuses cached metadata offline without sharing entries between sources', async () => {
  const cache = memoryCache();
  const first = createRepository(api(['onnx/model_q4.onnx']), models, { cache });
  await first.load(models[0].id);
  const returning = createRepository(offline, models, { cache });
  const reused = await returning.load(models[0].id);
  assert.deepEqual(reused.precisions, ['q4']);
  const mirror = createRepository(offline, models, {
    cache,
    modelBaseUrl: 'https://mirror.example/models/',
    metadataBaseUrl: 'https://mirror.example/api/models/',
  });
  await assert.rejects(mirror.load(models[0].id), /Offline/);
});

test('model-specific exports differ and mismatched revisions cannot advertise choices', async () => {
  const second = [{ ...models[0], id: 'example/other-model' }];
  const repository = createRepository(
    api(['onnx/model_quantized.onnx', 'onnx/model_fp16.onnx']),
    second,
  );
  const data = await repository.load(second[0].id);
  assert.deepEqual(data.precisions, ['fp16', 'q8']);
  const wrong = createRepository(api(['onnx/model_q4.onnx'], '0'.repeat(40)), models);
  await assert.rejects(wrong.load(models[0].id), /revision does not match/);
});

test('denied persistent cache permits session-only discovery and coalesces concurrent requests', async () => {
  let calls = 0;
  const repository = createRepository(
    async (url) => {
      calls++;
      return Response.json(
        url.includes('/api/models/')
          ? { sha: revision, siblings: [{ rfilename: 'onnx/model_q4.onnx' }] }
          : {},
      );
    },
    models,
    {
      cache: {
        async open() {
          throw new Error('Denied');
        },
      },
    },
  );
  await Promise.all([repository.load(models[0].id), repository.load(models[0].id)]);
  assert.equal(calls, 2);
});
