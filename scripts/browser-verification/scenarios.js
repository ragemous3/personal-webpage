import assert from 'node:assert/strict';

import { exerciseReconnectUI } from './reconnect-ui.js';

const until = async (condition, timeout = 5000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Observation deadline exceeded (${timeout} ms)`);
};
const crashedPages = new WeakSet();
const open = async (context, origin) => {
  const page = await context.newPage();
  page.on('error', () => crashedPages.add(page));
  await page.goto(`${origin}/__verify/probe`);
  await page.waitForFunction(() => globalThis.probe, { timeout: 3000 });
  return page;
};
const message = async (page, task, requestId) => {
  const handle = await page.waitForFunction(
    ({ task, requestId }) =>
      globalThis.probe.events.find(
        ({ data }) => data.task === task && (!requestId || data.requestId === requestId),
      ),
    { timeout: 5000, polling: 25 },
    { task, requestId },
  );
  const result = await handle.jsonValue();
  await handle.dispose();
  return result.data;
};
const owner = async (context, origin) => {
  const page = await open(context, origin);
  await page.evaluate(() => globalThis.probe.host());
  await message(page, 'llm:ready');
  return page;
};
const answer = async (page, id, question = id) => {
  await page.evaluate(({ id, question }) => globalThis.probe.query(id, { question }), {
    id,
    question,
  });
  const result = await message(page, 'llm:message:response', id);
  assert.equal(result.payload.generated_text, `Controlled ${question}`);
  assert.equal(result.id, await page.evaluate(() => globalThis.probe.client));
};
const targetExists = async (targets, predicate) => {
  const list = await targets();
  return list.some((entry) => predicate(entry));
};
const noReplay = (events, id) =>
  assert.equal(
    events.filter((event) => event.type === 'accepted' && event.requestId === id).length,
    1,
  );
const definitions = [
  [
    'first-tab-answer',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      await answer(a, 'one', 'alpha');
    },
  ],
  [
    'retrieval-generation-transport',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.host(false, 'vectordb'));
      await message(a, 'vectordb:ready');
      await a.evaluate(() => globalThis.probe.query('retrieval', { query: 'context' }, 'vectordb'));
      const retrieval = await message(a, 'vectordb:query:response');
      assert.deepEqual(retrieval.payload.response.neighbors, [0]);
      await answer(a, 'generation', 'context-backed');
    },
  ],
  [
    'owner-renderer-crash',
    async ({ context, origin, evidence }) => {
      const a = await owner(context, origin);
      const b = await owner(context, origin);
      const session = await a.createCDPSession();
      void session.send('Page.crash').catch(() => {});
      await until(() => crashedPages.has(a));
      evidence.events.push({ type: 'renderer-crash-observed' });
      await b.evaluate(() => globalThis.probe.begin('crashed-runtime').catch(() => {}));
      assert.equal(
        await b.evaluate(() => globalThis.probe.events.some(({ data }) => data.runtimeFailure)),
        true,
      );
      await b.evaluate(() => globalThis.probe.reconnect());
      await answer(b, 'after-crash');
    },
  ],
  [
    'second-tab-request-isolation',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      const b = await owner(context, origin);
      await answer(b, 'second', 'beta');
      assert.equal(
        await a.evaluate(() =>
          globalThis.probe.events.some(({ data }) => data.requestId === 'second'),
        ),
        false,
      );
    },
  ],
  [
    'simultaneous-claim-routing',
    async ({ context, origin, evidence }) => {
      const [a, b] = await Promise.all([owner(context, origin), owner(context, origin)]);
      await Promise.all([answer(a, 'simultaneous-a'), answer(b, 'simultaneous-b')]);
      await until(() => evidence.events.some((event) => event.type === 'initialized'));
      assert.equal(
        evidence.events.filter((event) => event.type === 'initialized' && event.role === 'llm')
          .length,
        1,
      );
    },
  ],
  [
    'active-cancellation-transport',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('cancel-me', { delay: 500, stopDelay: 80 }));
      await message(a, 'llm:stream:response');
      const start = Date.now();
      await a.evaluate(() => globalThis.probe.cancel('cancel-me'));
      await message(a, 'llm:stopped', 'cancel-me');
      assert.ok(Date.now() - start >= 60, 'Stop was acknowledged before the driver stopped');
      await answer(a, 'after-cancel');
      assert.equal(
        await a.evaluate(() =>
          globalThis.probe.events.some(
            ({ data }) =>
              data.payload === 'deliberately late chunk' ||
              (data.task === 'llm:message:response' && data.requestId === 'cancel-me'),
          ),
        ),
        false,
      );
    },
  ],
  [
    'owner-close-departure',
    async ({ context, origin, evidence }) => {
      const a = await owner(context, origin);
      const b = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('departing', { hold: true }));
      await message(a, 'llm:stream:response');
      await a.close();
      await answer(b, 'surviving');
      await until(() =>
        evidence.events.some(
          (event) => event.type === 'stopped' && event.requestId === 'departing',
        ),
      );
      assert.equal(evidence.events.filter((event) => event.type === 'initialized').length, 1);
    },
  ],
  [
    'freeze-retains-accepted-work',
    async ({ context, origin, evidence }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('frozen', { delay: 300 }));
      await message(a, 'llm:stream:response');
      const session = await a.createCDPSession();
      try {
        await session.send('Page.setWebLifecycleState', { state: 'frozen' });
        await until(() =>
          evidence.events.some((event) => event.type === 'answer' && event.requestId === 'frozen'),
        );
      } finally {
        await session.send('Page.setWebLifecycleState', { state: 'active' });
        await session.detach();
      }
      await message(a, 'llm:message:response', 'frozen');
    },
  ],
  [
    'navigation-back-attachment',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      await owner(context, origin);
      await a.goto(`${origin}/about-me/`);
      await a.goBack();
      await a.waitForFunction(() => globalThis.probe, { timeout: 3000 });
      await a.waitForFunction(() => globalThis.probe.attached());
      await answer(a, 'after-back');
    },
  ],
  [
    'model-worker-stop-observation',
    async ({ context, origin, evidence, targets }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('stopped-model', { stopWorker: true }));
      await until(() => evidence.events.some((event) => event.type === 'closing'));
      await until(
        async () =>
          !(await targetExists(targets, (target) => /llm\.shared-worker\./.test(target.url))),
      );
      await until(() =>
        a.evaluate(() =>
          globalThis.probe.events.some(
            ({ data }) => data.requestId === 'stopped-model' && data.error,
          ),
        ),
      );
      await a.evaluate(() =>
        Promise.all([globalThis.probe.reconnect(), globalThis.probe.reconnect()]),
      );
      await answer(a, 'after-model-failure');
      noReplay(evidence.events, 'stopped-model');
    },
  ],
  [
    'coordinator-target-close-observation',
    async ({ context, origin, targets, browser }) => {
      const a = await owner(context, origin);
      await owner(context, origin);
      const list = await targets();
      const info = list.find((entry) => /runtime-coordinator\.shared-worker\./.test(entry.url));
      const target = browser.targets().find((entry) => entry.url() === info.url);
      const session = await target.createCDPSession();
      await session.send('Runtime.evaluate', { expression: 'globalThis.close()' }).catch(() => {});
      await session.detach().catch(() => {});
      await until(
        async () => !(await targetExists(targets, (entry) => entry.targetId === info.targetId)),
      );
      await a.evaluate(() => globalThis.probe.begin('lost-coordinator').catch(() => {}));
      assert.equal(
        await a.evaluate(() => globalThis.probe.events.some(({ data }) => data.runtimeFailure)),
        true,
      );
      await a.evaluate(() => globalThis.probe.reconnect());
      await answer(a, 'after-coordinator-failure');
    },
  ],
  [
    'failed-initialization-retry-cleanup',
    async ({ context, origin, targets }) => {
      const a = await open(context, origin);
      await a.evaluate(() => globalThis.probe.host(true));
      const failure = await message(a, 'llm:init');
      assert.equal(failure.runtimeFailure, true);
      await a.evaluate(() => globalThis.probe.reconnect());
      await answer(a, 'after-init-failure');
      const list = await targets();
      assert.equal(list.filter((entry) => /llm\.shared-worker\./.test(entry.url)).length, 1);
    },
  ],
  [
    'three-shared-worker-topology',
    async ({ context, origin, targets, evidence }) => {
      const [a, b] = await Promise.all([owner(context, origin), owner(context, origin)]);
      for (const page of [a, b]) {
        await page.evaluate(() => globalThis.probe.host(false, 'vectordb'));
        await message(page, 'vectordb:ready');
      }
      const list = await targets();
      for (const url of Object.values(evidence.workerMap))
        assert.equal(
          list.filter(
            (entry) => new URL(entry.url).pathname === url && entry.type === 'shared_worker',
          ).length,
          1,
        );
      assert.equal(list.filter((entry) => entry.type === 'worker').length, 0);
      for (const role of ['llm', 'vectordb'])
        assert.equal(
          evidence.events.filter((event) => event.type === 'initialized' && event.role === role)
            .length,
          1,
        );
    },
  ],
  [
    'queued-cancellation',
    async ({ context, origin, evidence }) => {
      const a = await owner(context, origin);
      const b = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('active', { hold: true }));
      await message(a, 'llm:stream:response');
      await b.evaluate(() => {
        globalThis.probe.query('queued');
        globalThis.probe.cancel('queued');
      });
      await message(b, 'llm:stopped', 'queued');
      await a.evaluate(() => globalThis.probe.cancel('active'));
      await message(a, 'llm:stopped', 'active');
      await answer(b, 'after-queue');
      assert.equal(
        evidence.events.some((event) => event.type === 'accepted' && event.requestId === 'queued'),
        false,
      );
    },
  ],
  [
    'coordinator-model-failure-recovery',
    async ({ context, origin, evidence }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.host(false, 'vectordb'));
      await message(a, 'vectordb:ready');
      await a.evaluate(() => globalThis.probe.query('failure', { stopWorker: true }));
      await until(() =>
        a.evaluate(() => globalThis.probe.events.some(({ data }) => data.runtimeFailure)),
      );
      await a.evaluate(() =>
        Promise.all([globalThis.probe.reconnect(), globalThis.probe.reconnect()]),
      );
      await answer(a, 'recovered');
      assert.equal(
        evidence.events.filter((event) => event.role === 'vectordb' && event.type === 'initialized')
          .length,
        1,
      );
      noReplay(evidence.events, 'failure');
    },
  ],
  [
    'concurrent-reconnect',
    async (context) => {
      await owner(context.context, context.origin);
      await exerciseReconnectUI(context);
    },
  ],
  [
    'full-response-drain',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.begin('whole-response'));
      await a.evaluate(() => {
        globalThis.configured = false;
        globalThis.probe.configure({ llm: { generation: { max_new_tokens: 8 } } }).then(() => {
          globalThis.configured = true;
        });
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await a.evaluate(() => globalThis.configured), false);
      await a.evaluate(() => globalThis.probe.finish('whole-response'));
      await a.waitForFunction(() => globalThis.configured);
      await answer(a, 'after-drain');
    },
  ],
];

const contextTargets = async (session, id, origin) => {
  const result = await session.send('Target.getTargets');
  return result.targetInfos.filter(
    (target) => target.browserContextId === id && target.url.startsWith(origin),
  );
};
export const runControlled = async (browser, origin, evidence) => {
  for (const [name, exercise] of definitions) {
    const context = await browser.createBrowserContext();
    const session = await browser.target().createCDPSession();
    const targets = contextTargets.bind(undefined, session, context.id, origin);
    const start = evidence.events.length;
    const result = {
      name,
      kind: 'native-production-runtime-controlled-model-drivers',
      verdict: 'PASS',
    };
    try {
      const current = { ...evidence, record: (event) => evidence.events.push(event) };
      Object.defineProperty(current, 'events', { get: () => evidence.events.slice(start) });
      await exercise({ context, origin, evidence: current, targets, browser });
    } catch (error) {
      result.verdict = 'FAIL';
      result.reason = error.stack;
      result.ownerTicket = '20261029-193942';
    } finally {
      result.targets = await targets();
      const currentPages = await context.pages();
      const pages = currentPages.filter((page) => !crashedPages.has(page));
      result.pages = await Promise.all(
        pages.map((page) =>
          page
            .evaluate(() =>
              globalThis.probe
                ? { client: globalThis.probe.client, events: globalThis.probe.events }
                : null,
            )
            .catch(() => null),
        ),
      );
      result.events = evidence.events.slice(start);
      result.workerCounts = Object.fromEntries(
        Object.entries(evidence.workerMap).map(([role, url]) => [
          role,
          result.targets.filter((target) => new URL(target.url).pathname === url).length,
        ]),
      );
      await context.close();
      await session.detach();
      result.cleanup = 'Owned browser context closed';
      evidence.scenarios.push(result);
    }
  }
};
