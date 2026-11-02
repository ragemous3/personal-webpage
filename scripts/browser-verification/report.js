const recordInitialization = (state, event) => {
  const count = (state.loads.get(event.role) ?? 0) + 1;
  state.loads.set(event.role, count);
  if (count > 1) state.findings.push({ code: 'duplicate-initialization', role: event.role });
};
const recordRecovery = (state, event) => {
  if (state.recovery.has(event.role))
    state.findings.push({ code: 'overlapping-recovery', role: event.role });
  state.recovery.add(event.role);
};
const recordEvent = (state, event) => {
  const key = `${event.client}:${event.requestId}`;
  const handlers = {
    accepted: () => state.pending.set(key, event),
    answer: () => state.pending.delete(key),
    stopped: () => state.pending.delete(key),
    error: () => state.pending.delete(key),
    initialized: () => recordInitialization(state, event),
    'worker-stopped': () => {
      if (event.ready === true) state.findings.push({ code: 'stale-readiness', role: event.role });
    },
    'recovery-start': () => recordRecovery(state, event),
    'recovery-end': () => state.recovery.delete(event.role),
  };
  handlers[event.type]?.();
};
export const assessObservations = ({ mode, events }) => {
  if (!Array.isArray(events) || events.length === 0)
    return {
      mode,
      inferenceVerified: false,
      verdict: 'BLOCKED',
      findings: [{ code: 'no-observations' }],
    };
  const state = { findings: [], pending: new Map(), loads: new Map(), recovery: new Set() };
  for (const event of events) recordEvent(state, event);
  for (const event of state.pending.values())
    state.findings.push({
      code: 'stranded-request',
      requestId: event.requestId,
      client: event.client,
    });
  return {
    mode,
    inferenceVerified: false,
    verdict: state.findings.length > 0 ? 'FAIL' : 'PASS',
    findings: state.findings,
  };
};
