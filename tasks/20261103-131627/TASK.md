# Store routine verification evidence as retained artifacts

- STATUS: CLOSED
- PRIORITY: 100
- TAGS: task, verification

## Background

The user approved the proposed evidence-storage policy and requested implementation and local commits. Routine screenshots/reports should be review artifacts; reusable skills/scripts/tests and approved baselines stay in Git. The five curated JSON files for the three-SharedWorker migration remain the documented audit exception. Existing historical ticket records are preserved.

Ticket gate: closed verification ticket 20261027-104746 supplies the runner; closed migration ticket 20261029-193942 supplies the curated exception. Neither implements routine artifact storage, retention or CI publication. This is the explicitly approved policy follow-up, not a reopening of their completed behavior.

## Prerequisites

The approved proposal covers documentation, ignored artifact paths, post-teardown existence checks, CI upload/retention and summary links. Browser entry/controlled modes can run on hosted CI; real-model modes retain local data/model prerequisites and require an accessible uploaded artifact/archive before shared handoff.

## Acceptance criteria

- [x] Skills/workflow distinguish reusable assets and approved baselines from routine run evidence, with an explicit migration/audit exception and no automatic promotion via --baseline.
- [x] Browser verification defaults to a unique gitignored artifacts/verification/<run-id>/ directory; explicit output overrides and assessment behavior remain supported.
- [x] Required run files and the JSON report are checked after application teardown; missing/empty expected evidence produces ERROR and evidenceRetained false. Reports preserve source identity, command, results and blocked/skipped checks.
- [x] Test CI uploads execution output even after failure with 90-day retention. A manual workflow runs entry/controlled verification and publishes all resulting evidence with run/mode identity and links.
- [x] Local-only evidence is identified as such in the instructions; ticket summaries use accessible links and retention, while historical migration records remain unchanged.

## Dependencies

- [Verification infrastructure](../20261027-104746/TASK.md), completed.
- [RuntimeCoordinator migration](../20261029-193942/TASK.md), implemented in PR #21; its current local head is the follow-up base.

## Definition of Done

- [x] Focused file-finalization and CLI checks, lint/type checks, native entry/controlled artifact-retention checks and full post-review suite pass. Product-scenario failures remain visible and are reported separately.
- [x] Required Standards and Spec reviews pass; blast-radius disposition recorded.
- [x] Signed commits are created and added to PR #21 under the subsequent publication approval. No merge or deployment is requested.

### Execution record

Approved design: the five-point recommendation immediately preceding “Make the changes and commit them.” Guided approval handling reuses that explicit scope; no Autopilot publication grant is inferred. Finish condition is local commit handoff; publication is outside this request. Branch chore/verification-artifact-storage; fixed review base c31ab566b46c1df0b0b153ac702c544ef632a59e. Stages 0–2 use the already-approved follow-up design. Stage 3 begins with a failing public evidence-finalization test. Seams: real filesystem cleanup/finalization catches missing retained outputs; CLI checks cover default/explicit directory contract and assessment preservation; native browser runs verify actual screenshots/reports survive. CI syntax is checked locally and reviewed; hosted execution is not claimed without publication. Focused command: node --import ./scripts/typescript-test.loader.js --test tests/verification-artifacts.spec.js tests/browser-verification.spec.js. Full suite: npm test after both reviews. Native entry/controlled runs use ignored artifact output. No inference behavior changes; real-model cache/performance reruns are not needed for storage-only changes.

### Stages 3–4 results

Implemented the storage policy, unique ignored default output, declared artifact manifest and post-teardown validation. Test/verification workflows request 90-day always-run uploads and expose artifact links; the manual workflow supports entry/controlled modes without adding model provisioning. Existing historical and migration evidence is unchanged.

Focused artifact/assessment checks: 19 passed. ESLint and TypeScript exit 0. Actionlint v1.7.12 validates both workflows; YAML parsing also succeeds. Native entry with default output PASS: its screenshot and report exist after teardown and evidenceRetained is true. Native controlled verification retains a readable report, returns exit 1 and reports FAIL accurately (16 PASS, one concurrent-reconnect timeout). An isolated unchanged worktree at c31ab566b46c1df0b0b153ac702c544ef632a59e also returns FAIL (16 PASS, one coordinator recovery failure; concurrent reconnect passes there). No application runtime files changed. These recovery failures are baseline observations, not passing product journeys or a reason to suppress failure status. Storage behavior is verified on both success and failure paths; no product recovery fix is included in this storage follow-up.

Local-only evidence: artifacts/verification/entry-2026-11-03T13-22-51-866Z-eadba0ab-a9f6-41fa-a39a-6c7acd84e8b9/, artifacts/verification/policy-controlled/ and artifacts/verification/unchanged-base-controlled/. These are workspace paths, not durable review links. No hosted workflow/upload is claimed: the user requested local commits, not publication. Before a later PR handoff, publish the artifacts with retention as required by the new policy. Full-suite result remains pending until both required reviews pass. Next action: signed snapshot and read-only Standards/Spec reviews, then final full suite and local commit handoff.

Signed stage 4 implementation snapshot: b7553648ebaaa13d025718f02fe0fe8da765bdcf. Stage 5 entry: both read-only reviews assess the next metadata snapshot against fixed base c31ab566b46c1df0b0b153ac702c544ef632a59e. The isolated baseline worktree and its dependency symlink are removed; run artifacts remain in the ignored output directory.

### Review fix pass

The Standards review of 4954ef2f614da532513d2b213f2b023f53c4a6d0 passed. Spec review found one P2: an early entry assertion failure did not declare or capture its required screenshot. Both reviews and later checks were invalidated before the fix. Two focused regressions first failed; entry now declares the screenshot before opening the page and attempts capture before closing on both success and failure. A missing screenshot yields ERROR and evidenceRetained false; an available failure screenshot preserves the product FAIL result. Cache screenshots remain conditional on reaching the returning-session observation; prerequisite-blocked runs require their report only.

Stage 3/4 repeat: focused artifact/assessment checks 21 passed; ESLint, TypeScript and Actionlint exit 0. Native entry command: PATH=/workspace/tools/hugo-0.158.0:$PATH node scripts/browser-verification/run.js --mode entry. Result PASS with screenshot/report retained after teardown; local-only output artifacts/verification/entry-2026-11-03T13-34-03-438Z-765c7f65-dc4d-4bf0-8197-881371beeff1/. Cleanup review found no further changes needed. Next: both read-only reviews of the signed fix snapshot, then blast-radius disposition and full suite. No application runtime source changed.

### Final local handoff

Stage 5: Standards and Spec independently reviewed implementation SHA 33a7651af71d86c8972c36fa1a7c533a02447fd8 against fixed base c31ab566b46c1df0b0b153ac702c544ef632a59e. Both report zero remaining actionable findings. The Spec screenshot finding is resolved and covered by regressions.

Stage 6: blast-radius assessment is not applicable: this follow-up changes local verification output and workflow configuration, with no bulk writes, account changes, live data deletion or deployment. Existing curated migration evidence is preserved.

Stage 7: npm test ran after both reviews against 33a7651af71d86c8972c36fa1a7c533a02447fd8: 92 tests passed, zero failed/skipped. Focused checks, lint, typecheck, workflow syntax and native entry checks passed as recorded above. Controlled worker-recovery failures remain separately reported baseline observations; real-model cache/performance checks and hosted uploads were not run for this storage-only follow-up. Routine output remains ignored and local-only until optional publication. These summary/status edits do not change the reviewed implementation.

The requested local-commit handoff is complete. Publication, CI artifact links and PR creation remain outside the user's request; no push, merge or deployment occurred. Ticket remains OPEN under the repository's publication-based closure rule, with no unfinished authorized implementation work. Next action, only if separately requested: publish this branch, attach retained evidence, and complete PR handoff.

### PR #21 publication

The user subsequently requested “Add them to pr 21,” authorizing branch publication and the PR/documentation updates needed for handoff. Guided mode and the reviewed implementation remain unchanged. The five signed follow-up commits were fast-forward pushed to refactor/20261029-193942-runtime-coordinator at 3e4fd1e0a8cd5bf25361979e310b4488c5975e3a; the PR description now covers artifact storage and its verification limits. Auto-merge and merge-queue entry were both absent before publication. No merge or deployment was requested or performed.

PR: https://github.com/ragemous3/personal-webpage/pull/21. Local full-suite result remains 92 passing tests on reviewed implementation 33a7651af71d86c8972c36fa1a7c533a02447fd8. Subsequent commits change ticket records only. Hosted CI is triggered on the PR branch; its checks and retained test output provide shared evidence with the configured 90-day retention. Native browser reports remain local-only and are not represented as uploaded artifacts; the new manual workflow is unavailable for dispatch until published on the default branch. The entry run passed and the controlled recovery failures remain documented above.

Stage 7 publication completes this artifact-storage ticket; CLOSED denotes PR handoff, not merge. Three existing PR review threads concern README naming guidance and configuration-factory utilities, outside this storage follow-up; they remain unresolved. Next action: inspect CI for the closure head and report its status with the PR link.
