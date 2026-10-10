#!/usr/bin/env python3
"""Create one native TATR ticket from a completed Markdown body."""

import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import sys
import time


HEADINGS = {
    "task": (
        "Background", "Prerequisites", "Acceptance criteria", "Dependencies",
        "Definition of Done",
    ),
    "bug": (
        "Summary and impact", "Steps to reproduce", "Expected behavior",
        "Actual behavior", "Environment and evidence", "Acceptance criteria",
    ),
}


def parse_priority(value):
    try:
        priority = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("priority must be an integer")
    if not 0 <= priority <= 2147483647:
        raise argparse.ArgumentTypeError("priority must be between 0 and 2147483647")
    return priority


def split_sections(body):
    sections = []
    fence = None
    for line in body.splitlines():
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
        heading = re.fullmatch(r"## (.+)", line) if fence is None and not marker else None
        if heading:
            sections.append((heading.group(1), []))
        elif sections:
            sections[-1][1].append(line)
    return sections


def validate_body(kind, body):
    sections = split_sections(body)
    if tuple(name for name, _ in sections) != HEADINGS[kind]:
        raise ValueError(f"body headings must be: {', '.join(HEADINGS[kind])}")
    if any(not "\n".join(lines).strip() for _, lines in sections):
        raise ValueError("each template section must contain content or an explicit unknown")
    template = Path(__file__).resolve().parents[1] / "assets" / f"{kind}.md"
    placeholders = re.findall(r"<[^\n<>]+>", template.read_text(encoding="utf-8"))
    if any(placeholder in body for placeholder in placeholders):
        raise ValueError("replace all template placeholders before creating a ticket")
    for name, lines in sections:
        if name in ("Acceptance criteria", "Definition of Done"):
            content = "\n".join(lines)
            if not re.search(r"^- \[ \] .+", content, re.MULTILINE):
                raise ValueError(f"{name} needs an unchecked checklist item")
            if re.search(r"^- \[[xX]\] ", content, re.MULTILINE):
                raise ValueError(f"leave {name} unchecked for future work")


def create_ticket(project, kind, title, body, priority=100, tags=(), suffix="", type_tag=None):
    project = Path(project).resolve(strict=True)
    if not project.is_dir():
        raise ValueError("project must be an existing directory")
    title = title.strip()
    if not title or any(character in title for character in "\r\n\x00"):
        raise ValueError("title must be a nonempty single line")
    if suffix and not re.fullmatch(r"[A-Za-z0-9-]+", suffix):
        raise ValueError("suffix must contain only ASCII letters, digits, or hyphens")
    if not 0 <= priority <= 2147483647:
        raise ValueError("priority must be between 0 and 2147483647")
    type_tag = kind if type_tag is None else type_tag
    all_tags = list(dict.fromkeys((type_tag, *tags)))
    if any(not tag or re.search(r"[\s,\[\]\x00]", tag) for tag in all_tags):
        raise ValueError("each tag must be one nonempty token without commas or square brackets")
    body = body.strip()
    validate_body(kind, body)
    tasks = project / "tasks"
    if tasks.is_symlink():
        raise ValueError("tasks must be a directory inside the requested project, not a symlink")
    tasks.mkdir(exist_ok=True)
    ticket = None
    for _ in range(30):
        huid = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        if suffix:
            huid += "-" + suffix
        candidate = tasks / huid
        try:
            candidate.mkdir()
        except FileExistsError:
            time.sleep(1)
        else:
            ticket = candidate
            break
    if ticket is None:
        raise ValueError("could not reserve a unique ticket ID after 30 attempts")
    text = (
        f"# {title}\n\n- STATUS: OPEN\n- PRIORITY: {priority}\n"
        f"- TAGS: {', '.join(all_tags)}\n\n{body}\n"
    )
    path = ticket / "TASK.md"
    try:
        with path.open("x", encoding="utf-8", newline="\n") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        if path.exists():
            path.unlink()
        ticket.rmdir()
        raise
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True, type=Path)
    parser.add_argument("--kind", required=True, choices=tuple(HEADINGS))
    parser.add_argument("--title", required=True)
    parser.add_argument("--body-file", required=True, type=Path)
    parser.add_argument("--priority", type=parse_priority, default=100)
    parser.add_argument("--tag", action="append", default=[])
    parser.add_argument("--type-tag", help="override the default bug or task tag")
    parser.add_argument("--suffix", default="")
    args = parser.parse_args()
    try:
        body = args.body_file.read_text(encoding="utf-8")
        path = create_ticket(
            args.project, args.kind, args.title, body, args.priority, args.tag,
            args.suffix, args.type_tag,
        )
    except (OSError, UnicodeError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
