---
# SPDX-License-Identifier: CC-BY-SA-4.0
# SPDX-FileCopyrightText: Netresearch DTT GmbH
name: git-workflow
description: "Use when establishing branching strategies, implementing Conventional Commits, creating or reviewing PRs, resolving PR review comments, merging PRs (including CI verification, auto-merge queues, and post-merge cleanup), managing PR review threads, merging PRs with signed commits, handling merge conflicts, verifying a merge didn't silently drop changes, syncing a long-diverged branch (e.g. master into integration), rebasing a long-lived branch onto a moved base or splitting one into several PRs, integrating Git with CI/CD, setting up git hooks (lefthook, captainhook, husky, pre-commit), debugging hook-install failures in git worktrees, or working in a bare-repo plus per-branch-worktree layout, including consolidating a directory that holds both a plain clone and a .bare. The pull-request tooling is GitHub-only; references/pull-request-workflow.md carries the GitLab equivalents. Not for creating releases (use github-release) or diagnosing BLOCKED/won't-merge PRs (use github-project)."
license: "(MIT AND CC-BY-SA-4.0). See LICENSE-MIT and LICENSE-CC-BY-SA-4.0"
compatibility: "Requires git, gh CLI; yq for .spec-cleanup.yml."
metadata:
  author: Netresearch DTT GmbH
  version: "1.35.1"
  repository: https://github.com/netresearch/git-workflow-skill
allowed-tools: Bash(git:*) Bash(gh:*) Read Write
---

# Git Workflow Skill

## Not Here

Releases: `github-release`. BLOCKED-PR diagnosis: `github-project`.

**GitHub only.** Everything below the branching and commit sections — `pr-status.sh`, `pr-merge.sh`, the merge gate, review threads — speaks GitHub GraphQL. For a GitLab merge request the equivalent `glab` calls are in `references/pull-request-workflow.md` § *GitLab: the same gate with `glab`*.

## Critical Rules (Non-Negotiable)

1. **No direct push to main** — always open a PR.
2. **No merge before all threads resolved** (`references/pull-request-workflow.md`).
3. **No squash unless asked** — preserves atomic commits, signatures, bisection.
4. **No "tested/verified/working" without pasted command output** — else say so.
5. **No edits to installed skill/plugin cache paths** (`~/.claude/skills/`, `~/.claude/plugins/cache/`, `**/.bare/**`) — always the repo worktree, verified by `pwd`.
6. **Force-push only with `--force-with-lease`** — never plain `--force`.
7. **Commit before rebase** — `add → commit → fetch → rebase → push` (a dirty tree aborts it).
8. **No editorializing** — state what changed, not how good it is (`references/no-editorializing.md`).

## Reference Files

| Reference | Content Triggers |
|-----------|-----------------|
| `references/commit-conventions.md` | Conventional commits, DCO sign-off |
| `references/pull-request-workflow.md` | PR merge gate, signed rebase, posting a review with inline suggestions |
| `references/ci-cd-integration.md` | CI watching, git mirrors |
| `references/advanced-git.md` | Rebase (incl. non-interactive `rebase -i`), cherry-pick, bisect, stash, worktrees, reflog, hanging push/fetch (SSH mux) |
| `references/github-releases.md` | → `github-release` skill |
| `references/git-hooks-setup.md` | Hook frameworks, hooks per stage |
| `references/claude-code-hooks.md` | `settings.json` merge gate, cache-path rejection, auto-lint |
| `references/code-quality-tools.md` | shellcheck, shfmt, git-absorb, difftastic |
| `references/merge-gate-watcher.md` | Waiting on a gate, a watcher the harness killed, merge-driver loop, check taxonomy, stale-SHA rerun |
| `references/spec-cleanup.md` | Planning artifacts off the base branch |
| `references/no-editorializing.md` | No self-praise, no narrating the expected |

## Project pull request diagrams

For architecture and feature PR descriptions, use Mermaid to show the complete affected flow grouped by the repository's actual layers. Include the relevant contracts and abstract classes, their concrete implementations, and external services or storage. Show the request and response path, including Local/Online alternatives and configuration flow where affected. Use separate focused diagrams when one graph would become hard to read.

Use solid, labelled arrows for runtime calls or data flow. Use dotted, labelled arrows for contract dependencies, implementation and inheritance; name those relationships accurately. Keep actual class and contract names so a reviewer can find them in the repository. Do not invent layers or imply that a contract is a running component.

Use exact names and casing from the code for classes, functions, contracts and abstracts. Identify worker entry points, API routes, packages and storage with their real filenames, route strings or identifiers. Keep role descriptions as secondary annotations, not invented component names. Split boxes that combine distinct implementations when their identity or change status would be unclear.

Give newly introduced components and dependencies a green border, for example `classDef added stroke:#2da44e,stroke-width:3px;` and `class NewComponent added;`. Determine what is new from the PR diff against its fixed review base. Modified or moved existing components keep their default borders. Include a short legend explaining the green border and arrow styles; preserve the theme's default fill.

Keep composition wiring outside the connected layer flow. It may appear as a separate box containing only the composition entry-point names, with no edges to the layers or their classes. Check the diagram against the current implementation before updating the PR, and preserve the PR's verification and limitation notes.

## Conventional Commits

```
<type>[scope]: <description>
```

`feat` MINOR, `fix` PATCH; full type list and DCO sign-off in `references/commit-conventions.md`.
**Breaking**: `!` after type, or `BREAKING CHANGE:` in the footer.
**Branches**: `feature/TICKET-123-description`, `release/1.2.0`

## Hook Detection

```bash
ls lefthook.yml .lefthook.yml captainhook.json .pre-commit-config.yaml .husky/pre-commit 2>/dev/null || echo "No hooks"
```

Install commands per framework: `references/git-hooks-setup.md`.

## PR Merge Requirements

Before merging: threads resolved, CI green (incl. annotations), rebased, signed, **and reviewed** on the current head — by a human, a bot, or the author through `pr-merge.sh --self-reviewed`. A review is mandatory; a *bot* review is not, and one is waited for only while it is actually in flight. Rebase-only + signed: `git merge --ff-only`.

## Verification

```bash
./scripts/verify-git-workflow.sh /path/to/repository
# Gate state, next action:
./scripts/pr-status.sh [-R owner/repo] [PR] [--json] [--watch]
# Merge; refuses when the gate is shut:
./scripts/pr-merge.sh [-R owner/repo] [PR] [--dry-run|--self-reviewed]
# What a repository expects, before the first artifact:
./scripts/repo-contribution-preflight.sh [--repo <dir>] [--section docs|templates|packaging|ci|tools]
# Which copy is installed here (every script answers this):
./scripts/pr-status.sh --version
```

---

> **Contributing:** <https://github.com/netresearch/git-workflow-skill>
