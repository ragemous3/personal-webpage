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
const recordTerminal = (state, event) => {
  const key = `${event.client}:${event.requestId}`;
  if (!state.pending.has(key))
    state.findings.push({
      code: 'unexpected-response',
      client: event.client,
      requestId: event.requestId,
    });
  state.pending.delete(key);
};
const eventFields = {
  accepted: ['client', 'requestId'],
  answer: ['client', 'requestId'],
  stopped: ['client', 'requestId'],
  error: ['client', 'requestId'],
  initialized: ['role'],
  'worker-stopped': ['role'],
  'recovery-start': ['role'],
  'recovery-end': ['role'],
};
const supportedEvents = (events) =>
  Array.isArray(events)
    ? events.filter((event) => event && Object.hasOwn(eventFields, event.type))
    : [];
const validEvent = (event) =>
  eventFields[event.type].every(
    (field) => typeof event[field] === 'string' && event[field].trim().length > 0,
  ) &&
  (event.type !== 'worker-stopped' || typeof event.ready === 'boolean');

const recordEvent = (state, event) => {
  const key = `${event.client}:${event.requestId}`;
  const handlers = {
    accepted: () => state.pending.set(key, event),
    answer: () => recordTerminal(state, event),
    stopped: () => recordTerminal(state, event),
    error: () => recordTerminal(state, event),
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
  const observed = supportedEvents(events);
  if (observed.length === 0 || !observed.every((event) => validEvent(event)))
    return {
      mode,
      inferenceVerified: false,
      verdict: 'BLOCKED',
      findings: [{ code: 'unusable-observations' }],
    };
  const state = { findings: [], pending: new Map(), loads: new Map(), recovery: new Set() };
  for (const event of observed) recordEvent(state, event);
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
