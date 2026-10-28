---
name: deslop
description: Remove unnecessary code and align changes with project style before review.
---

# Clean up introduced code

Read the ticket and its fixed review-base SHA. Inspect the changes against that base. Include staged and unstaged changes.

Check for these issues:

- Redundant comments that repeat the code.
- Defensive checks or exception handling that the interface does not need.
- Casts to `any` that bypass type checks.
- Avoidable nesting that an early return can remove.
- Code that conflicts with the surrounding project style.

Make small edits. Preserve the required behavior and necessary validation. If you find a behavioral bug, return it to implementation with a focused regression check. Repeat cleanup after that fix.

Run checks affected by the edits. Report what changed and any remaining issue.
