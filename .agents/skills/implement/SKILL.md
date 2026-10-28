---
name: implement
description: Implement a prepared TATR ticket with TDD and focused checks. Return to the project workflow before cleanup, reviews, commits, or publication.
---

# Implement the ticket

Read the supplied ticket and state its title. Require approved scope, implementation acceptance criteria, confirmed test seams, and a criterion-to-command mapping for focused tests and relevant type checks. Use the ticket's branch and fixed review base.

For each implementation criterion:

1. Use `tdd` at each listed seam. Add one failing behavioral test, implement enough to pass it, then take the next slice. Follow the confirmed interface; consult `codebase-design` for the seam's design guidance.
2. After implementing the criterion, run every command mapped to it. Fix failures before starting the next criterion. If a fix affects a completed criterion, rerun its mapped checks too.
3. Record changed files, command results, and criterion status in the ticket. If no behavioral test applies, use the approved verification method and record why.

Stay within the approved scope. Missing inputs, tools, or test infrastructure block the affected work. Report the exact gap to the workflow. Return proposed scope, interface, or verification-plan changes to its design stage; do not decide them silently.

Return when all implementation criteria are met and their focused checks pass. Report changes, results, and any blocker.

Do not run the full test suite, cleanup stage, reviews, commits, push, or PR operations. The [implementation flow](../../../docs/implementation-flow.md) schedules them.
