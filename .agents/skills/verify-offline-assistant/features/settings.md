# Assistant settings

Entry: `chatbot-provider >>> assistant-configuration`.

Visitors select Local or Online, model and execution backend. Advanced controls expose model-supported precision and generation settings. Settings persist and propagate between tabs. Configuration may remain pending while accepted work finishes. Metadata failures show Retry model options. Rejected settings show Retry settings and, when available, Switch back. Restore defaults is a separate action.

Run `npm run verify:browser -- --mode settings` for controlled UI, propagation, cancellation, pending changes and explicit backend-recovery behavior. UI transitions have a bounded 60-second deadline. Inspect its screenshot and per-scenario report. These fixtures prove UI and coordination, not model accuracy, actual GPU availability or performance.

For real-model coverage, the Local UI helper seeds CPU/WASM preferences and the cache journey changes execution preferences while preserving history. Those checks do not cover every model/backend combination. Use the model revision recorded in the report when judging precision choices.
