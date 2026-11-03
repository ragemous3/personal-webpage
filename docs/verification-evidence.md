# Verification evidence storage

Commit reusable verification instructions, feature maps, helper scripts, tests, fixtures and approved test baselines. Store outputs from an individual run as artifacts. Evidence must survive application teardown and remain accessible for review; surviving locally does not make it a permanent Git record.

| Material                                                              | Storage                                                                                   |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Skills, feature maps, scripts, tests and fixtures                     | Git, alongside the application                                                            |
| Approved visual or other regression baselines                         | Git, under reviewed test assets such as `tests/baselines/`                                |
| Run screenshots, videos, traces, reports, coverage and execution logs | Gitignored run directory, then PR/CI artifacts or an approved durable archive             |
| Selected evidence for a major migration or audit                      | A curated Git record or durable archive, with the reason and scope recorded in its ticket |

A baseline defines an expected result for future comparisons and changes through review. A screenshot or report from today's run records an observation. The browser CLI's `--baseline` flag permits reporting known FAIL/BLOCKED behavior; it neither approves a test baseline nor authorizes committing the report.

## Local runs

```sh
npm run verify:browser -- --mode entry
npm run verify:browser -- --mode controlled
```

The CLI defaults to a unique `artifacts/verification/<run-id>/` directory. `--evidence <new-directory>` remains available for explicit output selection. Never put run output inside disposable application/profile directories or generated site output. Keep model downloads, browser profiles and generated indices out of evidence uploads.

The report identifies the source revision, worktree digest, command, selected mode, outcomes, blocked/skipped checks and expected artifacts. After application teardown, the runner writes the report and checks that every declared artifact is a readable, nonempty file. Missing evidence makes the run ERROR and leaves `evidenceRetained` false. A retained report can still describe FAIL or BLOCKED checks; retention is not a passing verdict.

Before shared handoff, publish the run folder through CI or attach/archive it in an approved durable location. A `/tmp/` or workspace path alone is local-only evidence. Keep a concise ticket summary with the tested SHA, commands, outcomes, skipped or unattempted checks, artifact links and retention/expiry. Link the ticket or artifact from the PR. Do not paste routine execution logs into the ticket or commit the run directory.

## CI publication and retention

The test job in [CI](../.github/workflows/ci.yml) captures `npm test` output, including the commit SHA and command, and uploads it even when tests fail. Bash pipe failure handling preserves the failing test exit code.

The manual [Browser verification workflow](../.github/workflows/verification.yml) offers `entry`, `controlled` or both on the selected ref. It uploads the JSON reports, declared screenshots and execution logs after success or failure. Each artifact name includes its run ID and attempt, and browser artifacts include the selected mode. Artifact links appear in the workflow summary. The manual workflow must be published to GitHub before it can be dispatched; local changes alone do not execute hosted checks.

Both workflows request **90-day retention**, subject to repository limits. These links expire. Before expiry, copy anything needed for a longer audit into an approved durable archive or select a small, reviewed committed record. The manual hosted workflow does not provision the real models/index required for `cache` or `performance`; those runs retain their existing prerequisites and must publish their local evidence separately before shared handoff.

## Historical evidence

Historical run reports, including the RuntimeCoordinator migration reports, have been removed from the current tree. Ticket links point to their immutable Git revisions so past observations remain accessible. Git history is preserved. Future routine evidence belongs in retained PR/CI artifacts or a durable archive; it is not committed. Keep concise verification summaries in tickets and preserve reusable tools and approved baselines in Git.

The manual workflow also accepts an optional `local_report` JSON input. The attachment step checks the report's source digest against the checked-out branch before saving it, and records that it was submitted from a local run rather than executed by CI. Use this for real-model reports produced with local model/data prerequisites. This uploads the JSON report only; screenshots and other referenced files require their own accessible archive and are not implied by the report attachment.
