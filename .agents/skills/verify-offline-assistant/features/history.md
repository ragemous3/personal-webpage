# Conversation history

Entry: the chat log, page reload, Local/Online selection and a new browser tab.

IndexedDB stores messages behind the history repository. Session storage keeps the active conversation ID for reload. A fresh tab or browser session starts a new conversation; stored older conversations are not automatically selected. Changing Local/Online preserves the current history. A conversation picker is future work.

The Local UI helper checks reload restoration and fresh-tab isolation with real models. The settings and Online journeys check history preservation across mode changes using controlled models. Inspect the report rather than inferring persistence from an answer screenshot.

Reset clears the current conversation. Storage failures expose Retry saving; that action must retry persistence without generating another answer. Treat unattempted storage-failure and old-conversation selection paths separately from passing reload coverage.
