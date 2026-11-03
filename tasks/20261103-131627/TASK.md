# Store routine verification evidence as retained artifacts

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task, verification

## Background

The user approved the proposed evidence-storage policy and requested implementation and local commits. Routine screenshots/reports should be review artifacts; reusable skills/scripts/tests and approved baselines stay in Git. The five curated JSON files for the three-SharedWorker migration remain the documented audit exception. Existing historical ticket records are preserved.

Ticket gate: closed verification ticket 20261027-104746 supplies the runner; closed migration ticket 20261029-193942 supplies the curated exception. Neither implements routine artifact storage, retention or CI publication. This is the explicitly approved policy follow-up, not a reopening of their completed behavior.

## Prerequisites

The approved proposal covers documentation, ignored artifact paths, post-teardown existence checks, CI upload/retention and summary links. Browser entry/controlled modes can run on hosted CI; real-model modes retain local data/model prerequisites and require an accessible uploaded artifact/archive before shared handoff.

## Acceptance criteria

- [ ] Skills/workflow distinguish reusable assets and approved baselines from routine run evidence, with an explicit migration/audit exception and no automatic promotion via --baseline.
- [ ] Browser verification defaults to a unique gitignored artifacts/verification/<run-id>/ directory; explicit output overrides and assessment behavior remain supported.
- [ ] Required run files and the JSON report are checked after application teardown; missing/empty expected evidence produces ERROR and evidenceRetained false. Reports preserve source identity, command, results and blocked/skipped checks.
- [ ] Test CI uploads execution output even after failure with 90-day retention. A manual workflow runs entry/controlled verification and publishes all resulting evidence with run/mode identity and links.
- [ ] Local-only evidence is identified as such in the instructions; ticket summaries use accessible links and retention, while historical migration records remain unchanged.

## Dependencies

- [Verification infrastructure](../20261027-104746/TASK.md), completed.
- [RuntimeCoordinator migration](../20261029-193942/TASK.md), implemented in PR #21; its current local head is the follow-up base.

## Definition of Done

- [ ] Focused file-finalization and CLI checks, lint/type checks, native entry/controlled artifact-retention checks and full post-review suite pass. Product-scenario failures remain visible and are reported separately.
- [ ] Required Standards and Spec reviews pass; blast-radius disposition recorded.
- [ ] Signed local commits are created. No push, PR, merge or deployment is requested for this follow-up.

### Execution record

Approved design: the five-point recommendation immediately preceding “Make the changes and commit them.” Guided approval handling reuses that explicit scope; no Autopilot publication grant is inferred. Finish condition is local commit handoff; publication is outside this request. Branch chore/verification-artifact-storage; fixed review base c31ab566b46c1df0b0b153ac702c544ef632a59e. Stages 0–2 use the already-approved follow-up design. Stage 3 begins with a failing public evidence-finalization test. Seams: real filesystem cleanup/finalization catches missing retained outputs; CLI checks cover default/explicit directory contract and assessment preservation; native browser runs verify actual screenshots/reports survive. CI syntax is checked locally and reviewed; hosted execution is not claimed without publication. Focused command: node --import ./scripts/typescript-test.loader.js --test tests/verification-artifacts.spec.js tests/browser-verification.spec.js. Full suite: npm test after both reviews. Native entry/controlled runs use ignored artifact output. No inference behavior changes; real-model cache/performance reruns are not needed for storage-only changes.

### Stages 3–4 results

Implemented the storage policy, unique ignored default output, declared artifact manifest and post-teardown validation. Test/verification workflows request 90-day always-run uploads and expose artifact links; the manual workflow supports entry/controlled modes without adding model provisioning. Existing historical and migration evidence is unchanged.

Focused artifact/assessment checks: 19 passed. ESLint and TypeScript exit 0. Actionlint v1.7.12 validates both workflows; YAML parsing also succeeds. Native entry with default output PASS: its screenshot and report exist after teardown and evidenceRetained is true. Native controlled verification retains a readable report, returns exit 1 and reports FAIL accurately (16 PASS, one concurrent-reconnect timeout). An isolated unchanged worktree at c31ab566b46c1df0b0b153ac702c544ef632a59e also returns FAIL (16 PASS, one coordinator recovery failure; concurrent reconnect passes there). No application runtime files changed. These recovery failures are baseline observations, not passing product journeys or a reason to suppress failure status. Storage behavior is verified on both success and failure paths; no product recovery fix is included in this storage follow-up.

Local-only evidence: artifacts/verification/entry-2026-11-03T13-22-51-866Z-eadba0ab-a9f6-41fa-a39a-6c7acd84e8b9/, artifacts/verification/policy-controlled/ and artifacts/verification/unchanged-base-controlled/. These are workspace paths, not durable review links. No hosted workflow/upload is claimed: the user requested local commits, not publication. Before a later PR handoff, publish the artifacts with retention as required by the new policy. Full-suite result remains pending until both required reviews pass. Next action: signed snapshot and read-only Standards/Spec reviews, then final full suite and local commit handoff.

Signed stage 4 implementation snapshot: b7553648ebaaa13d025718f02fe0fe8da765bdcf. Stage 5 entry: both read-only reviews assess the next metadata snapshot against fixed base c31ab566b46c1df0b0b153ac702c544ef632a59e. The isolated baseline worktree and its dependency symlink are removed; run artifacts remain in the ignored output directory.
