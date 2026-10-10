# Implementation flow

Use this flow for feature work and bug fixes. Invoking `implementation-flow` authorizes the stages below, including the user-invoked `grill-with-docs` and `implement` skills. Follow the user's requested scope and any limits on implementation, commits, or external actions.

```text
grill-with-docs → tatr-ticket → implement → code-review → blast-radius
                                  ↑          │              │
                                  └── fixes ─┴── fixes ──────┘
```

The TATR ticket is the implementation spec and the handoff between stages. Keep the same ticket through fixes. Resume an existing ticket at its recorded stage; return to grilling when a requirement or scope decision is unresolved.

## Required skills and tools

Read each stage's installed `SKILL.md` when entering that stage. The project supplies `tatr-ticket` and `git-workflow` under `.agents/skills/`. Install the following global skills with their supporting files:

| Source repository | Skill directory | Purpose |
| --- | --- | --- |
| `mattpocock/skills` | `skills/engineering/grill-with-docs` | Design interview and domain documentation |
| `mattpocock/skills` | `skills/productivity/grilling` | Interview dependency |
| `mattpocock/skills` | `skills/engineering/domain-modeling` | Glossary and ADR dependency |
| `mattpocock/skills` | `skills/engineering/implement` | Implement the ticket |
| `mattpocock/skills` | `skills/engineering/tdd` | TDD at agreed seams |
| `mattpocock/skills` | `skills/engineering/codebase-design` | Interface and seam design reference used by TDD |
| `mattpocock/skills` | `skills/engineering/code-review` | Standards and spec review |
| `kishormorol/blast-radius` | Repository root | Review bulk operations on real data |

If a required skill is missing, identify it before beginning its stage. The issue tracker is already configured here: local TATR Markdown files, with the selected ticket's full path supplied to `implement` and `code-review`.

Use [npryce/adr-tools](https://github.com/npryce/adr-tools) for ADR creation. Its `adr` command must be on PATH. `.adr-dir` selects `docs/adr`. On another machine, install ADR Tools using its [installation instructions](https://github.com/npryce/adr-tools/blob/master/INSTALL.md); the Git installation adds the downloaded repository's `src/` to PATH. TATR's CLI is optional for creating tickets because the project skill includes a Python helper; use the CLI when available to list and inspect them.

## 1. Grill and record decisions

Run `grill-with-docs`, which loads `grilling` and `domain-modeling`. Read the relevant code and existing domain docs before asking questions the repository can answer. Work through the design in rounds and wait for the user's answers.

Resolve the intended behavior, constraints, scope, acceptance criteria, dependencies, and test seams. For each proposed seam, explain what it catches and misses. Record which seams the user confirmed; if the repository has no suitable test harness, agree how it will be introduced or how this change will be verified.

Update the glossary as terms settle. Create ADRs when the domain-modeling criteria apply: a meaningful cost to reverse, surprising without context, and a real trade-off. For a new decision, use the CLI:

```sh
VISUAL=true EDITOR=true adr new 'Decision title'
# To replace decision 2:
VISUAL=true EDITOR=true adr new -s 2 'Replacement decision title'
```

Fill the generated record with the agreed decision, alternatives, trade-offs, and consequences using the domain-modeling ADR guidance. Preserve the CLI's number and supersession links. Link relevant records in the ticket. `.adr-dir` is already initialized; use `adr init docs/adr` only when configuring a new repository.

Finish this stage when the user confirms shared understanding, including the scope and test seams. This confirmation approves the design handoff; it does not expand authorization for external actions.

## 2. Create the TATR ticket

Use the project `tatr-ticket` skill to create a native `tasks/<HUID>/TASK.md`, choosing a task or bug template as appropriate. Put the agreed behavior and constraints in the ticket rather than relying on conversation history. Capture confirmed seams, verification commands or agreed verification work, dependencies, and glossary/ADR links within the selected template's sections.

Read the completed ticket back and check it matches the confirmed design. Preserve one independently verifiable outcome per ticket; link dependent tickets when a split is needed. Use the ticket's acceptance criteria as the spec for both implementation and review.

Start a feature branch from fetched `origin/main` using the project git-workflow skill. Pin its initial merge-base with `origin/main` as a full commit SHA in the ticket, together with the branch and current stage. Keep that review base fixed through all implementation and fix iterations. An existing branch or user-specified base takes precedence.

Finish when the ticket is valid TATR Markdown, its requirements and seams are recorded, and the branch and review base are known.

## 3. Implement with TDD

Load `implement` and pass the full TATR ticket path; state its title before starting. Use `tdd` at the confirmed seams, consulting `codebase-design` when the interface needs design work. Work in vertical slices: one failing behavioral test, enough implementation to pass it, then the next slice. Changes to the agreed interface or scope return to the user and update the ticket before implementation proceeds.

Discover checks from the repository configuration. Run relevant type checks and focused tests during implementation, and the full applicable suite before review. Record commands, results, and missing tooling honestly; an absent harness is a prerequisite to resolve, not a passing test run.

This project flow controls review order and completion. Override `implement`'s default review-then-commit timing: create a signed implementation snapshot using git-workflow before entering code-review so its committed `HEAD` diff includes the work. The next stage satisfies `implement`'s code-review step; run it once per snapshot.

Finish when the ticket's implementation is complete, applicable checks pass, and the implementation snapshot is committed.

## 4. Review standards and spec

Run `code-review` with the pinned review-base SHA and the TATR ticket path as its spec source. It compares `git diff <base>...HEAD`; include all intended implementation files in the committed snapshot first. Supply the project standards sources and the local TATR tracker context. Follow the skill's separate Standards and Spec reviews, including its parallel reviewers.

Record findings against the reviewed commit. Return actionable findings to `implement` as a scoped fix pass on the same ticket and branch. Preserve the agreed seams, add relevant regression coverage, rerun checks, commit the fixes, and restart at code-review. Resolve judgement calls with evidence or a documented decision; do not silently discard them.

Finish when both review axes have no unresolved actionable findings for the latest implementation snapshot.

## 5. Review blast radius

Load `kishormorol/blast-radius`. Review whether the implementation can perform bulk or destructive writes on real data, including queued jobs, batch messages, permission changes, and deletion scripts. If none apply, record that finding with its reason and the reviewed commit in the ticket.

When applicable, follow the skill: justify the filter, classify affected records as act/exclude/unknown, inspect dependencies, check dry-run and apply separation, and verify guards against ambiguity, repeated side effects, and the wrong environment. Examine code and use read-only evidence or isolated fixtures. Applying a live operation follows the user's explicit scope and authorization.

This final stage does not replace the skill's pre-operation check: perform its checks before any real bulk write during earlier stages too. The optional Claude-specific hook is separate setup and is not required by this workflow.

Return findings to `implement` as scoped fixes. After fixes, rerun code-review and then blast-radius; a later implementation change invalidates both prior reviews. If the data cannot support a safe decision, keep the ticket OPEN, record the missing evidence, and stop the affected operation.

Finish when all applicable blast-radius findings are resolved or the stage is explicitly recorded as not applicable.

## 6. Complete and publish

Record acceptance-criteria evidence, check results, reviewed commit IDs, dispositions for review findings, and blast-radius applicability in the ticket. Update its current stage so another session can resume accurately. Mark it CLOSED only when the acceptance criteria and Definition of Done are met; keep pending reviews or checks visible in an OPEN ticket.

Use git-workflow for signed commits and PR creation when publishing is authorized. Include the TATR ticket path and verification evidence in the PR. Any implementation changes after review return to stages 4 and 5. Merge only when separately authorized and the repository's merge requirements are satisfied.
