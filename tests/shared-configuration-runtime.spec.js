import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SharedBotCoordinator } from '@/layers/data/shared-bot-coordinator.data';
import { defaultAssistantSettings } from '@/layers/services/configuration.service';

const port = () => ({ messages: [], postMessage(value) { this.messages.push(value); } });
const command = (client, action, fields = {}) => ({ kind: 'assistant', client, action, ...fields });
const configuration = { settings: defaultAssistantSettings, model: { source: 'llm.js' }, database: { source: 'db.js' } };

test('a follower attaches to one live owner without requesting another model load', () => {
  const coordinator = new SharedBotCoordinator();
  const owner = port();
  const follower = port();
  coordinator.receive(owner, command('owner', 'register'));
  coordinator.receive(owner, command('owner', 'claim'));
  coordinator.receive(owner, command('owner', 'configure', { configuration }));
  const load = owner.messages.find((message) => message.action === 'load');
  assert.ok(load);
  coordinator.receive(owner, command('owner', 'loaded', { epoch: load.epoch, revision: load.revision }));
  coordinator.receive(follower, command('follower', 'register'));
  coordinator.receive(follower, command('follower', 'configure', { configuration }));
  assert.equal(owner.messages.filter((message) => message.action === 'load').length, 1);
  assert.equal(follower.messages.filter((message) => message.action === 'load').length, 0);
  assert.equal(follower.messages.at(-1).state.ready, true);
});

const live = () => {
  const coordinator = new SharedBotCoordinator();
  const owner = port();
  const follower = port();
  for (const [id, connection] of [['owner', owner], ['follower', follower]])
    coordinator.receive(connection, command(id, 'register'));
  coordinator.receive(owner, command('owner', 'claim'));
  coordinator.receive(owner, command('owner', 'configure', { configuration }));
  const load = owner.messages.find((message) => message.action === 'load');
  coordinator.receive(owner, command('owner', 'loaded', { epoch: load.epoch, revision: load.revision }));
  return { coordinator, owner, follower, epoch: load.epoch };
};

test('follower retrieval and generation go to the owner; responses return only to the requester', () => {
  const { coordinator, owner, follower, epoch } = live();
  coordinator.receive(follower, command('follower', 'request', { channel: 'vectordb', message: { task: 'vectordb:query', requestId: 'answer', payload: { query: 'Question' } } }));
  const run = owner.messages.find((message) => message.action === 'run');
  assert.ok(run);
  coordinator.receive(owner, command('owner', 'reply', { epoch, channel: 'vectordb', message: { task: 'vectordb:query:response', requestId: run.message.requestId, payload: { response: { neighbors: [0] } } } }));
  assert.equal(follower.messages.at(-1).action, 'event');
  assert.equal(follower.messages.at(-1).message.requestId, 'answer');
  assert.equal(owner.messages.filter((message) => message.action === 'event').length, 0);
});

test('shared replacement waits through retrieval, prompt construction and generation', () => {
  const { coordinator, owner, follower, epoch } = live();
  coordinator.receive(follower, command('follower', 'request', { channel: 'vectordb', message: { task: 'vectordb:query', requestId: 'answer', payload: { query: 'Question' } } }));
  const run = owner.messages.find((message) => message.action === 'run');
  coordinator.receive(owner, command('owner', 'configure', { configuration: { ...configuration, settings: { ...defaultAssistantSettings, execution: 'wasm' } } }));
  coordinator.receive(owner, command('owner', 'reply', { epoch, channel: 'vectordb', message: { task: 'vectordb:query:response', requestId: run.message.requestId, payload: {} } }));
  assert.equal(owner.messages.filter((message) => message.action === 'load').length, 1);
  coordinator.receive(follower, command('follower', 'request', { channel: 'llm', message: { task: 'llm:query', requestId: 'answer', payload: { message: [] } } }));
  coordinator.receive(owner, command('owner', 'reply', { epoch, channel: 'llm', message: { task: 'llm:message:response', requestId: run.message.requestId, payload: { generated_text: 'Answer' } } }));
  assert.equal(owner.messages.filter((message) => message.action === 'load').length, 2);
  assert.equal(owner.messages.findLast((message) => message.action === 'load').configuration.settings.execution, 'wasm');
});

test('pending settings close admission and cancellation waits for worker acknowledgment', () => {
  const { coordinator, owner, follower, epoch } = live();
  const query = command('follower', 'request', { channel: 'vectordb', message: { task: 'vectordb:query', requestId: 'answer', payload: { query: 'Question' } } });
  coordinator.receive(follower, query);
  const routed = owner.messages.find((message) => message.action === 'run').message.requestId;
  coordinator.receive(owner, command('owner', 'reply', { epoch, channel: 'vectordb', message: { task: 'vectordb:query:response', requestId: routed, payload: {} } }));
  coordinator.receive(follower, command('follower', 'request', { channel: 'llm', message: { task: 'llm:query', requestId: 'answer', payload: {} } }));
  coordinator.receive(owner, command('owner', 'configure', { configuration: { ...configuration, settings: { ...defaultAssistantSettings, precision: 'auto' } } }));
  coordinator.receive(follower, command('follower', 'request', { channel: 'vectordb', message: { task: 'vectordb:query', requestId: 'too-late', payload: {} } }));
  assert.match(follower.messages.at(-1).message.error.message, /Settings are changing/);
  coordinator.receive(follower, command('follower', 'finish', { message: { task: 'finish', requestId: 'answer' } }));
  assert.equal(owner.messages.filter((message) => message.action === 'load').length, 1);
  coordinator.receive(owner, command('owner', 'reply', { epoch, channel: 'llm', message: { task: 'llm:cancel:response', requestId: routed } }));
  assert.equal(owner.messages.filter((message) => message.action === 'load').length, 2);
});

test('closing the owner interrupts requests and stale owner replies cannot reach clients', () => {
  const { coordinator, owner, follower, epoch } = live();
  coordinator.receive(follower, command('follower', 'request', { channel: 'vectordb', message: { task: 'vectordb:query', requestId: 'answer', payload: {} } }));
  const routed = owner.messages.find((message) => message.action === 'run').message.requestId;
  coordinator.receive(owner, command('owner', 'disconnect'));
  assert.ok(follower.messages.some((message) => message.message?.error?.message.includes('owner closed')));
  const before = follower.messages.length;
  coordinator.receive(owner, command('owner', 'reply', { epoch, channel: 'llm', message: { task: 'llm:message:response', requestId: routed, payload: { generated_text: 'Stale' } } }));
  assert.equal(follower.messages.length, before);
  coordinator.receive(follower, command('follower', 'claim'));
  assert.equal(follower.messages.filter((message) => message.action === 'load').length, 1);
  assert.equal(follower.messages.filter((message) => message.action === 'run').length, 0);
});

test('startup failure still identifies the selection when configuration arrives before ownership', () => {
  const coordinator = new SharedBotCoordinator();
  const owner = port();
  coordinator.receive(owner, command('owner', 'register'));
  coordinator.receive(owner, command('owner', 'configure', { configuration }));
  coordinator.receive(owner, command('owner', 'claim'));
  const load = owner.messages.find((message) => message.action === 'load');
  coordinator.receive(owner, command('owner', 'loaded', { epoch: load.epoch, revision: load.revision, error: 'Model unavailable' }));
  assert.deepEqual(owner.messages.at(-1).state.selected, defaultAssistantSettings);
  assert.equal(owner.messages.at(-1).state.error, 'Model unavailable');
});

test('edits during shared initialization coalesce and stale readiness cannot enable clients', () => {
  const { coordinator, owner, follower, epoch } = live();
  coordinator.receive(owner, command('owner', 'configure', { configuration: { ...configuration, settings: { ...defaultAssistantSettings, execution: 'wasm' } } }));
  const loading = owner.messages.findLast((message) => message.action === 'load');
  const latest = { ...configuration, settings: { ...defaultAssistantSettings, execution: 'webgpu', maxNewTokens: 64 } };
  coordinator.receive(follower, command('follower', 'configure', { configuration: latest }));
  assert.equal(owner.messages.filter((message) => message.action === 'load').length, 2);
  coordinator.receive(owner, command('owner', 'loaded', { epoch, revision: loading.revision }));
  const newest = owner.messages.findLast((message) => message.action === 'load');
  assert.deepEqual(newest.configuration, latest);
  assert.equal(follower.messages.at(-1).state.ready, false);
  coordinator.receive(owner, command('owner', 'loaded', { epoch, revision: loading.revision }));
  assert.equal(follower.messages.at(-1).state.ready, false);
  coordinator.receive(owner, command('owner', 'loaded', { epoch, revision: newest.revision }));
  assert.equal(follower.messages.at(-1).state.ready, true);
});
