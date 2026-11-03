import assert from 'node:assert/strict';

export const runPerformance = async (browser, origin, evidence) => {
  const result = {
    name: 'real-cpu-cancellation-throughput',
    kind: 'real-model-comparison',
    verdict: 'FAIL',
    baseline:
      'Same Qwen q4 / WASM / one thread / prompt / generation settings in a dedicated Worker without cooperative yields; actual production SharedWorker with yields',
  };
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/__verify/performance`);
    await page.waitForFunction(() => globalThis.runBenchmark);
    result.dedicated = await page.evaluate(() => globalThis.runBenchmark('dedicated'));
    result.shared = await page.evaluate(() => globalThis.runBenchmark('shared'));
    const elapsed = (run) => {
      const values = run.samples
        .filter((sample) => !sample.warmup)
        .map((sample) => sample.elapsedMs)
        .toSorted((a, b) => a - b);
      return values[1];
    };
    assert.deepEqual(
      result.shared.samples.map((sample) => sample.answer),
      result.dedicated.samples.map((sample) => sample.answer),
    );
    result.medianElapsedRatio = elapsed(result.shared) / elapsed(result.dedicated);
    assert.ok(
      result.shared.cancellation.stopMs < 30_000,
      'Cancellation exceeded the production stop deadline',
    );
    result.verdict = 'PASS';
    result.limitations =
      'Three measured answers plus one warm-up per topology on this CPU; equal output checked. Process scheduling, cache warming and measurement noise limit comparisons; no WebGPU claim or general performance guarantee.';
  } catch (error) {
    result.reason = error.stack;
  }
  evidence.scenarios.push(result);
};
