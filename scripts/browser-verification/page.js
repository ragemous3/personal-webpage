export const createPage = async (owner) => {
  const page = await owner.newPage();
  await page.evaluateOnNewDocument(() => {
    globalThis.verificationChat = () => {
      let root = globalThis.document;
      for (const tag of ['chatbot-provider', 'chatbot-host', 'chatbot-offline-provider, chatbot-online-provider'])
        root = root?.querySelector(tag)?.shadowRoot;
      return root?.querySelector('chat-container');
    };
  });
  return page;
};
