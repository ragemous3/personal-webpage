import assert from 'node:assert/strict';

const until = async (condition, timeout = 2000) => {
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
const message = async (page, task, channel = 'hub') => {
  await page.waitForFunction(
    ({ task, channel }) =>
      globalThis.probe.events.some(
        (event) => event.channel === channel && event.data.task === task,
      ),
    { timeout: 2000, polling: 25 },
    { task, channel },
  );
  return page.evaluate(
    ({ task, channel }) =>
      globalThis.probe.events.find((event) => event.channel === channel && event.data.task === task)
        .data,
    { task, channel },
  );
};
const owner = async (context, origin) => {
  const page = await open(context, origin);
  await page.evaluate(() => globalThis.probe.check());
  const claim = await message(page, 'llm:check', 'state');
  assert.equal(claim.payload.status, 'UNINITIALIZED');
  await page.evaluate(() => globalThis.probe.host());
  await message(page, 'llm:ready');
  return page;
};
const definitions = [
  [
    'first-tab-answer',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('one', { question: 'alpha' }));
      const answer = await message(a, 'llm:message:response');
      assert.equal(answer.payload.generated_text, 'Controlled alpha');
      assert.equal(answer.requestId, 'one');
      assert.equal(answer.id, await a.evaluate(() => globalThis.probe.client));
    },
  ],
  [
    'retrieval-generation-transport',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.host(false, 'vectordb'));
      await message(a, 'vectordb:ready');
      await a.evaluate(() => globalThis.probe.query('retrieval', { query: 'context' }, 'vectordb'));
      const result = await message(a, 'vectordb:query:response');
      assert.deepEqual(result.payload.response.neighbors, [0]);
      await a.evaluate(() => globalThis.probe.query('generation', { question: 'context-backed' }));
      const answer = await message(a, 'llm:message:response');
      assert.equal(answer.requestId, 'generation');
    },
  ],
  [
    'owner-renderer-crash',
    async ({ context, origin, evidence }) => {
      const a = await owner(context, origin);
      const b = await open(context, origin);
      let crashed = false;
      a.once('error', () => {
        crashed = true;
      });
      const session = await a.createCDPSession();
      void session.send('Page.crash').catch(() => {});
      await until(() => crashed, 5000);
      evidence.events.push({ type: 'renderer-crash-observed', at: Date.now() });
      await b.evaluate(() => globalThis.probe.check());
      const result = await message(b, 'llm:check', 'state');
      assert.equal(
        result.payload.status,
        'UNINITIALIZED',
        'Observed renderer crash leaves a stale claim',
      );
    },
  ],
  [
    'second-tab-request-isolation',
    async ({ context, origin }) => {
      await owner(context, origin);
      const b = await open(context, origin);
      await b.evaluate(() => {
        globalThis.probe.check();
        globalThis.probe.query('second', { question: 'beta' });
      });
      const result = await message(b, 'hub:query');
      assert.equal(
        result.error,
        undefined,
        'Joining tab cannot route its request to the shared model',
      );
    },
  ],
  [
    'simultaneous-claim-routing',
    async ({ context, origin }) => {
      await open(context, origin);
      const b = await open(context, origin);
      await b.evaluate(() => globalThis.probe.check());
      const result = await message(b, 'llm:check', 'state');
      assert.equal(
        result.payload.status,
        'UNINITIALIZED',
        'First claimant receives BUSY after another port consumes its claim',
      );
    },
  ],
  [
    'active-cancellation-transport',
    async ({ context, origin, evidence }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('cancel-me', { delay: 500 }));
      await message(a, 'llm:stream:response');
      await a.evaluate(() => globalThis.probe.cancel('cancel-me'));
      await until(() =>
        evidence.events.some(
          (event) => event.type === 'stopped' && event.requestId === 'cancel-me',
        ),
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      assert.equal(
        await a.evaluate(() =>
          globalThis.probe.events.some((event) => event.data.task === 'llm:message:response'),
        ),
        false,
      );
    },
  ],
  [
    'owner-close-departure',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      const b = await open(context, origin);
      await a.close();
      await b.evaluate(() => globalThis.probe.check());
      const result = await message(b, 'llm:check', 'state');
      assert.equal(
        result.payload.status,
        'UNINITIALIZED',
        'Closed owner leaves a stale BUSY claim',
      );
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
      await message(a, 'llm:message:response');
    },
  ],
  [
    'navigation-back-attachment',
    async ({ context, origin }) => {
      const a = await owner(context, origin);
      const original = await a.evaluate(() => globalThis.probe.client);
      const observer = await open(context, origin);
      await a.goto(`${origin}/about-me/`);
      await a.goBack();
      await a.waitForFunction(() => globalThis.probe, { timeout: 3000 });
      const restored = await a.evaluate(() => globalThis.probe.client);
      if (restored === original) {
        await a.evaluate(() => globalThis.probe.query('after-back', { question: 'back' }));
        await message(a, 'llm:message:response');
      } else {
        await a.evaluate(() => {
          globalThis.probe.events.length = 0;
          globalThis.probe.check();
        });
        const result = await message(a, 'llm:check', 'state');
        assert.equal(
          result.payload.status,
          'UNINITIALIZED',
          'Navigation leaves the old ownership claim',
        );
      }
      await observer.close();
    },
  ],
  [
    'model-worker-stop-observation',
    async ({ context, origin, evidence, targets }) => {
      const a = await owner(context, origin);
      await a.evaluate(() => globalThis.probe.query('stopped-model', { stopWorker: true }));
      await until(() => evidence.events.some((event) => event.type === 'closing'));
      await until(async () => {
        const list = await targets();
        return !list.some((target) => target.type === 'worker' && /llm\.worker\./.test(target.url));
      });
      const result = await a.evaluate(() =>
        globalThis.probe.events.filter((event) => event.data.requestId === 'stopped-model'),
      );
      assert.ok(
        result.some((event) => event.data.error),
        'Worker closed but the pending request receives no terminal failure',
      );
    },
  ],
  [
    'coordinator-target-close-observation',
    async ({ context, origin, targets, evidence }) => {
      const a = await owner(context, origin);
      const current = await targets();
      const target = current.find((entry) => entry.type === 'shared_worker');
      assert.ok(target, 'No native state SharedWorker target');
      const session = await context.browser().target().createCDPSession();
      try {
        const response = await session.send('Target.closeTarget', { targetId: target.targetId });
        evidence.events.push({
          type: 'coordinator-close-request',
          targetId: target.targetId,
          response,
        });
        try {
          await until(async () => {
            const list = await targets();
            return !list.some((entry) => entry.targetId === target.targetId);
          });
        } catch {
          throw Object.assign(
            new Error(
              'CDP accepted target close but termination was not observed; no crash claim is made',
            ),
            { name: 'VerificationBlocked' },
          );
        }
        await a.evaluate(() => {
          globalThis.probe.events.length = 0;
          globalThis.probe.check();
        });
        await message(a, 'llm:check', 'state');
      } finally {
        await session.detach();
      }
    },
  ],
  [
    'failed-initialization-retry-cleanup',
    async ({ context, origin, targets }) => {
      const a = await open(context, origin);
      await a.evaluate(() => globalThis.probe.host(true));
      const result = await message(a, 'llm:init');
      assert.match(result.error.message, /Controlled initialization failure/);
      await a.evaluate(() => globalThis.probe.host());
      await message(a, 'llm:ready');
      const currentTargets = await targets();
      const models = currentTargets.filter(
        (target) => target.type === 'worker' && /llm\.worker\./.test(target.url),
      );
      assert.equal(models.length, 1, 'Retry leaves the failed model worker alive');
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
      kind: 'native-production-coordination-controlled-models',
      verdict: 'PASS',
    };
    try {
      await exercise({ context, origin, evidence, targets });
    } catch (error) {
      result.verdict = error.name === 'VerificationBlocked' ? 'BLOCKED' : 'FAIL';
      result.reason = error.message;
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
      result.initializationCounts = Object.fromEntries(
        Object.keys(evidence.workerMap).map((role) => [
          role,
          result.events.filter((event) => event.type === 'initialized' && event.role === role)
            .length,
        ]),
      );
      await context.close();
      await session.detach();
      result.cleanup = 'Owned browser context closed';
      evidence.scenarios.push(result);
    }
  }
};
