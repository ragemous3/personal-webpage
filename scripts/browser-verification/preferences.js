export const seedVerificationPreferences = (page, mode) =>
  page.evaluateOnNewDocument((mode) => {
    if (!localStorage.getItem('assistant.preferences'))
      localStorage.setItem(
        'assistant.preferences',
        JSON.stringify({
          version: 1,
          preferences: {
            mode,
            model: 'Xenova/Qwen1.5-0.5B-Chat',
            execution: 'wasm',
            precision: 'q4',
            maxNewTokens: 32,
            sampling: false,
            temperature: 0.7,
            topP: 0.9,
          },
        }),
      );
  }, mode);
