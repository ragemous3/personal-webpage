# Implementation flow setup

The [implementation flow](implementation-flow.md) owns execution order. Use this reference to find or install a required skill or tool. Report a missing dependency before its stage; do not substitute another skill without approval.

## Project skills

Read these files from the repository:

- [tatr-ticket](../.agents/skills/tatr-ticket/SKILL.md): local `tasks/<HUID>/TASK.md` tickets.
- [implement](../.agents/skills/implement/SKILL.md): implementation and focused checks. This replaces the global implement dependency for this project.
- [tdd](../.agents/skills/tdd/SKILL.md): Matt Pocock's TDD method and test references.
- [code-review](../.agents/skills/code-review/SKILL.md): Matt Pocock's parallel Standards and Spec reviews.
- [deslop](../.agents/skills/deslop/SKILL.md): cleanup before review.
- [git-workflow](../.agents/skills/git-workflow/SKILL.md): signed commits, branches, PRs, and the existing status watcher.
- [verify-offline-assistant](../.agents/skills/verify-offline-assistant/SKILL.md): real application journeys and the feature map. This skill is a draft; [its ticket](../tasks/20261027-104746/TASK.md) lists prerequisites for the first successful live run.

## Global skills

Install each skill with its supporting files. Do not edit installed skill caches.

| Source repository | Skill directory | Purpose |
| --- | --- | --- |
| `mattpocock/skills` | `skills/engineering/grill-with-docs` | Design interview and domain documentation |
| `mattpocock/skills` | `skills/productivity/grilling` | Interview dependency |
| `mattpocock/skills` | `skills/engineering/domain-modeling` | Glossary and ADR rules |
| `mattpocock/skills` | `skills/engineering/codebase-design` | Interface and seam design reference |
| `cursor/plugins` | `pstack/skills/create-verification-skill` | Runtime verification instructions when missing |
| `kishormorol/blast-radius` | Repository root | Bulk operations on real data |
| `humanlayer/skills` | [`plugins/show-me/skills/show-me`](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md) | PR explanation |

Generate runtime verification instructions once. Maintain them when application behavior changes; do not regenerate them for each ticket. The optional Claude-specific blast-radius hook is not required.

## ADR Tools

Use [npryce/adr-tools](https://github.com/npryce/adr-tools) for ADR creation. Follow its [installation instructions](https://github.com/npryce/adr-tools/blob/master/INSTALL.md); the Git installation adds the downloaded repository's `src/` to PATH.

This repository's `.adr-dir` selects `docs/adr`. Use `adr init docs/adr` only for a new repository. For an agreed decision:

```sh
VISUAL=true EDITOR=true adr new 'Decision title'
# To replace decision 2:
VISUAL=true EDITOR=true adr new -s 2 'Replacement decision title'
```

Fill the generated record under the domain-modeling guidance. Preserve its number and supersession links. Link relevant records in the ticket.

## TATR

The tracker is already configured in `tasks/`. The TATR CLI is optional: the project skill includes a Python creation helper. Use the CLI to list or inspect tickets when available. Pass the selected ticket's full path to implement and code-review.
