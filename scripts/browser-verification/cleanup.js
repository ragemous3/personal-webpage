import { rm } from 'node:fs/promises';

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
  cleanup.browserProcess = state.browser?.process()
    ? {
        pid: state.browser.process().pid,
        exitCode: state.browser.process().exitCode,
        signalCode: state.browser.process().signalCode,
      }
    : null;
  cleanup.serverClosed = !state.site?.server.listening;
  cleanup.evidenceRetained = true;
  return cleanup;
};
