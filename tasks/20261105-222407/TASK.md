# Investigate intermittent coordinator termination and reconnect verification

- STATUS: OPEN
- PRIORITY: 150
- TAGS: task, verification

## Background

Investigate the intermittent coordinator-target-close-observation browser verification before choosing a fix. The settings ticket recorded 16 passing coordinator scenarios and one intermittent forced-close failure; the same scenario also failed on the unchanged earlier base. This does not yet establish whether the cause is the runtime, the browser driver, or timing in the fixture.

The scenario in scripts/browser-verification/scenarios.js closes the coordinator through a DevTools evaluation of globalThis.close(), waits for its target to disappear, starts a request, checks failure reporting, reconnects, and asks another question.

The user requested this distinct follow-up investigation after PR #22. Schedule the requested full online-mode feature first. This investigation is not a prerequisite for online-mode design.

## Prerequisites

- Current stage: investigation queued. No implementation mode or fix design selected.
- Use the merged main baseline and record its exact SHA, browser version, scenario command and prerequisites.
- Inspect existing runtime and verification contracts before reproducing. Run isolated browser attempts and retain both successful and failed results.

## Acceptance criteria

- [ ] Repeated isolated attempts record which step fails and the attempt count, including successful attempts; inability to reproduce is reported explicitly.
- [ ] Evidence distinguishes coordinator termination, failure notification, port release, reconnection, and answering after recovery.
- [ ] Compare the driver/fixture assumptions with actual browser lifecycle behavior and classify the cause as runtime defect, verification defect, environment limitation, or unresolved with specific missing evidence.
- [ ] Propose a bounded next action and regression check based on the findings. Preserve explicit reconnect, retained history, healthy resources and no automatic question replay as existing product requirements.

## Dependencies

- Historical runtime scope: [RuntimeCoordinator lifecycle and recovery](../20261029-193942/TASK.md), CLOSED.
- Existing harness: [application verification](../20261027-104746/TASK.md), CLOSED.
- Baseline disclosure: [settings integration](../20261028-123834/TASK.md), especially its supplemental coordinator-suite disposition; [artifact follow-up](../20261103-131627/TASK.md).
- **Blocked by:** None. [Online mode](../20261105-222408/TASK.md) takes scheduling precedence by user request (priority 200 versus this ticket's 150); this is not a technical dependency.

## Definition of Done

- [ ] All investigation acceptance criteria have evidence tied to the tested source and environment.
- [ ] Findings and a proposed disposition are recorded concisely; any implementation is separately scoped through the implementation flow.
- [ ] Routine reports, screenshots and logs remain ignored artifacts with reviewable links and stated retention; no routine evidence is committed.
