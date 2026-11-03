import { rm } from 'node:fs/promises';

const processState = (browser, errors) => {
  const child = browser?.process();
  if (child && child.exitCode === null && child.signalCode === null)
    errors.push('Owned browser process has not exited');
  return child ? { pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode } : null;
};

export const closeResources = async (state) => {
  const cleanup = {
    browserCreated: Boolean(state.browser),
    serverCreated: Boolean(state.site),
    errors: [],
  };
  try {
    await state.browser?.close();
  } catch (error) {
    cleanup.errors.push(`browser: ${error.message}`);
  }
  try {
    if (state.site) await new Promise((resolve) => state.site.server.close(resolve));
  } catch (error) {
    cleanup.errors.push(`server: ${error.message}`);
  }
  try {
    await rm(state.scratch, { recursive: true, force: true });
    cleanup.scratchRemoved = true;
  } catch (error) {
    cleanup.errors.push(`scratch: ${error.message}`);
  }
  cleanup.browserClosed = !state.browser?.connected;
  cleanup.browserProcess = processState(state.browser, cleanup.errors);
  cleanup.serverClosed = !state.site?.server.listening;
  cleanup.evidenceRetained = false;
  return cleanup;
};
