# Restore TypeScript parsing for chatbot assets

- STATUS: OPEN
- PRIORITY: 100
- TAGS: bug

## Summary and impact

The project compiler stops at a malformed placeholder before reporting useful type diagnostics for the offline chatbot refactor.

## Steps to reproduce

1. Run `tsc --noEmit --pretty false` from the project root.
2. Observe TS1109 errors at line 1 of `assets/layers/data/models/pollyfills.ts`.

## Expected behavior

Every included TypeScript source parses, allowing the compiler to report semantic diagnostics.

## Actual behavior

`pollyfills.ts` contains only `---`, which is not valid TypeScript. Compiler output reports two TS1109 errors and stops before checking the factories.

## Environment and evidence

Observed with global TypeScript 6.0.3. Project declares TypeScript ^5.9.3, but node_modules is absent. No code imports this file. Remove the malformed placeholder while retaining the file; do not implement speculative polyfills.

Confirmed verification seam: compile the source through the compiler CLI, observe failure before the fix and successful parsing after it, then run project-wide type checking to record remaining baseline diagnostics. This catches syntax validity but does not establish chatbot runtime correctness. Dependency installation and a Hugo build may expose unrelated pre-existing failures; record them rather than expanding this ticket.

Branch: feature/complete-offline-chatbot-refactor. Fixed review base: 9ae6426d1c4c917a5d8b2a7254860e9a607d053b. Current stage: code-review. Latest implementation snapshot: this signed work snapshot; record full SHA after commit. Standards review: pending. Spec review: pending. Blast-radius review: pending.
Next action: run Standards and Spec reviews against the signed snapshot, then blast-radius. No existing tests are present for this placeholder; the agreed compiler seam provides the regression check.

Verification evidence:

- Red: `tsc --ignoreConfig --noEmit --pretty false assets/layers/data/models/pollyfills.ts` exited 2 with two TS1109 errors.
- Green: the same focused command exited 0 with no output after removing `---`.
- `tsc --noEmit --pretty false` now reaches a TypeScript 6.0.3 deprecation error for baseUrl (TS5101), with no TS1109.
- `tsc --noEmit --pretty false --ignoreDeprecations 6.0` exited 2 and produced 68 diagnostic lines, including the factory argument mismatches, missing installed packages and other pre-existing errors. No TS1109 remains. This is baseline reporting, not a clean full type check.
- `hugo --destination /tmp/offline-refactor-hugo-build` exited 255: invalid TOML semicolon at config/_default/params.toml:20:51. No complete site build is claimed.
- `git diff --check` exited 0. TATR CLI parsed all three new tickets.
- Global TypeScript 6.0.3 is used for this small parsing check; project-locked tooling is pending dependency installation in the configuration ticket.

## Acceptance criteria

- [x] The compiler accepts the placeholder source without syntax errors.
- [x] Project-wide type checking proceeds beyond TS1109 parsing failures; remaining unrelated failures are recorded accurately.
- [ ] The red/green compiler results, signed implementation snapshot, Standards and Spec reviews, and blast-radius disposition are recorded before closure.
