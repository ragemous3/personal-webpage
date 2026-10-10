# TATR format

Use the native format from [tsoding/tatr](https://github.com/tsoding/tatr/blob/main/README.md). The body templates in this skill are ticket-writing conventions; TATR treats the body as Markdown.

## Files and header

Create `tasks/<HUID>/TASK.md` under the project root. Generate the HUID from the current UTC time as `YYYYMMDD-HHMMSS`. An optional suffix uses ASCII letters, digits, and hyphens. Reserve the directory exclusively; wait one second and retry on collision.

```markdown
# <title>

- STATUS: OPEN
- PRIORITY: 100
- TAGS: task

<completed template body>
```

Keep the metadata contiguous immediately after the title and its separating blank line. A blank line within metadata ends the block. Emit each property once.

Use `OPEN` and `CLOSED` as statuses. Represent additional workflow states with repository tags when needed. Tags split on commas and whitespace; use individual tokens and avoid square brackets for TQL compatibility.

Use numeric priority for relative sorting. The upstream creation default is `100`; higher numbers sort first by default. Follow existing repository conventions instead of assigning a universal urgency scale. The helper accepts nonnegative priorities through `2147483647` to avoid the upstream CLI's unsigned-to-int conversion issue; that is a helper limit, not a documented TATR scale.

The kind tags `bug` and `task` are this skill's defaults, not required upstream fields. Use `--type-tag` to substitute a repository's existing kind tag.

Place attachments inside the ticket directory and link them relatively. Keep attachment sizes appropriate for Git. Preserve existing custom properties when working with an existing ticket. For new custom properties, use distinct alphanumeric names supported by the upstream parser.

## Tool behavior

TATR's `new` command creates a header and a placeholder body. It has no built-in template option and fails on an ID collision. This skill's helper writes the completed body directly and reserves IDs atomically.

Use local `tatr help` for commands supported by the installed version. To find bugs with TQL, use `tatr ls :bug`. TQL filters tickets; it is not the ticket body format.

Verified upstream sources on 2026-10-10:

- [README specification](https://github.com/tsoding/tatr/blob/main/README.md)
- [Creation command and defaults](https://github.com/tsoding/tatr/blob/main/src/tatr.c)
- [Sorting and serialization](https://github.com/tsoding/tatr/blob/main/src/task.c)
- [Metadata parser](https://github.com/tsoding/tatr/blob/main/src/md.c)
