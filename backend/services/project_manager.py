"""
Owns the lifecycle of a generated project on disk: copying the right static
scaffold into storage/projects/{project_id}/, applying AI-generated files
through the path-checked writer, and keeping an append-only history.json log
of what happened in each iteration.

Never writes to scaffolds/react-vite/ or scaffolds/nextjs/ themselves -- only
to copies under storage/projects/.
"""
import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

from services.secure_file_ops import write_files_safely

BACKEND_DIR = Path(__file__).parent.parent
SCAFFOLDS_DIR = BACKEND_DIR.parent / "scaffolds"
PROJECTS_DIR = BACKEND_DIR / "storage" / "projects"
# Snapshots taken by approve_project() below -- separate from PROJECTS_DIR,
# which keeps changing as a project goes through more feedback iterations.
APPROVED_DIR = BACKEND_DIR / "storage" / "approved"

SCAFFOLD_BY_TECH = {"react": "react-vite", "nextjs": "nextjs"}

# Bookkeeping files project_manager itself writes at the project root -- not
# part of the generated app, excluded from file listings / exports / the
# change planner's view of "current files".
INTERNAL_FILES = {"history.json", "requirement.json"}
COPY_IGNORE = shutil.ignore_patterns("node_modules", ".next", "dist", "package-lock.json", ".git")

# Accepts both the random-hex ids already sitting in storage/projects/ from
# before this scheme existed (exactly 12 lowercase hex chars -- a-f0-9 is a
# subset of a-z0-9, so those still match here) AND new human-readable slugs
# (see _slugify): lowercase alphanumeric segments separated by single
# hyphens, no leading/trailing/double hyphens. This is the sole gate on what
# can become a directory name under PROJECTS_DIR/APPROVED_DIR -- see
# get_project_dir's second (realpath) check for the traversal guard proper.
_PROJECT_ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_PROJECT_ID_MAX_LEN = 64

# Windows device names that can't be used as a file/directory name regardless
# of extension or case -- a slug that collapses to exactly one of these
# (e.g. an app literally named "Con") gets a suffix before it's ever used.
_RESERVED_WINDOWS_NAMES = {
    "con", "prn", "aux", "nul",
    *(f"com{i}" for i in range(1, 10)),
    *(f"lpt{i}" for i in range(1, 10)),
}


def _slugify(name: str) -> str:
    """Lowercase, hyphen-separated slug derived from an app name, for use as
    a project_id / directory name. Restricted to [a-z0-9-] specifically so
    it's simultaneously a safe Windows directory name (no reserved
    characters, no trailing dot/space, no reserved device name) and a safe
    URL path segment as-is -- the frontend builds API URLs by directly
    interpolating project_id into a template literal (see api/client.js)
    without encoding it, so this needs to already be safe, not just
    filesystem-safe."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    slug = slug[:40].strip("-") or "app"
    if slug in _RESERVED_WINDOWS_NAMES:
        slug += "-app"
    return slug


def _unique_project_id(base_slug: str) -> str:
    """Resolves a name collision by appending -2, -3, ... to the base slug --
    e.g. four separate "TodoApp" projects become todo-app, todo-app-2,
    todo-app-3, todo-app-4. Checked case-insensitively (NTFS is
    case-insensitive regardless of what Python's str equality thinks) against
    every existing name in BOTH storage/projects/ and storage/approved/, so a
    new project can never collide with an existing in-progress OR approved
    directory -- collision-checking approved/ too is extra caution for a path
    that shouldn't currently be reachable (approved/{id} is only ever created
    by copying an already-unique projects/{id}), not a currently-necessary one."""
    existing = set()
    for base_dir in (PROJECTS_DIR, APPROVED_DIR):
        if base_dir.exists():
            existing.update(p.name.lower() for p in base_dir.iterdir() if p.is_dir())

    if base_slug not in existing:
        return base_slug
    n = 2
    while f"{base_slug}-{n}" in existing:
        n += 1
    return f"{base_slug}-{n}"


def _init_history(project_dir: Path) -> None:
    (project_dir / "history.json").write_text(json.dumps([], indent=2), encoding="utf-8")


def _log_event(project_dir: Path, event_type: str, files: list[str], reasoning: str) -> None:
    history_path = project_dir / "history.json"
    history = json.loads(history_path.read_text(encoding="utf-8"))
    history.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "files_changed": files,
        "reasoning": reasoning,
    })
    history_path.write_text(json.dumps(history, indent=2), encoding="utf-8")


def get_project_dir(project_id: str) -> Path:
    # TODO: real auth before this goes beyond local/personal use -- for the MVP,
    # anyone who knows a project_id can read/modify it. project_id format is
    # still validated here to prevent it being used as a traversal vector.
    if not _PROJECT_ID_RE.match(project_id) or len(project_id) > _PROJECT_ID_MAX_LEN:
        raise ValueError(f"Invalid project_id: {project_id!r}")
    project_dir = PROJECTS_DIR / project_id
    if Path(os.path.realpath(project_dir)).parent != Path(os.path.realpath(PROJECTS_DIR)):
        raise ValueError(f"Invalid project_id: {project_id!r}")
    if not project_dir.exists():
        raise FileNotFoundError(f"No project with id {project_id!r}")
    return project_dir


def approve_project(project_id: str) -> dict:
    """Snapshots the project's current files from storage/projects/{id}/ (the
    in-progress copy, which keeps changing on further feedback) into
    storage/approved/{id}/ -- a copy, not a move, so the in-progress copy is
    left exactly as it was. Marks the in-progress copy's own requirement.json
    with approved=True/approved_at so status survives future reads, and
    re-approving just overwrites the previous snapshot with the current
    state. Returns the updated requirement dict."""
    project_dir = get_project_dir(project_id)

    requirement_path = project_dir / "requirement.json"
    requirement = json.loads(requirement_path.read_text(encoding="utf-8"))
    requirement["approved"] = True
    requirement["approved_at"] = datetime.now(timezone.utc).isoformat()
    requirement_path.write_text(json.dumps(requirement, indent=2), encoding="utf-8")

    approved_dir = APPROVED_DIR / project_id
    APPROVED_DIR.mkdir(parents=True, exist_ok=True)
    if approved_dir.exists():
        shutil.rmtree(approved_dir)
    shutil.copytree(project_dir, approved_dir, ignore=COPY_IGNORE)

    _log_event(project_dir, event_type="approved", files=[], reasoning="Snapshotted current files into storage/approved/.")
    return requirement


def create_project(technology: str, requirement: dict, source_note: str | None = None) -> str:
    if technology not in SCAFFOLD_BY_TECH:
        raise ValueError(f"Unsupported technology: {technology!r}")

    project_id = _unique_project_id(_slugify(requirement.get("appName") or "app"))
    project_dir = PROJECTS_DIR / project_id
    scaffold_dir = SCAFFOLDS_DIR / SCAFFOLD_BY_TECH[technology]

    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copytree(scaffold_dir, project_dir, ignore=COPY_IGNORE)

    _init_history(project_dir)
    (project_dir / "requirement.json").write_text(json.dumps(requirement, indent=2), encoding="utf-8")
    reasoning = f"Created from the {SCAFFOLD_BY_TECH[technology]} scaffold for technology={technology}."
    if source_note:
        reasoning += f" {source_note}"
    _log_event(project_dir, event_type="project_created", files=[], reasoning=reasoning)
    return project_id


def apply_generated_files(project_id: str, technology: str, files: dict[str, str], event_type: str, reasoning: str) -> list[str]:
    project_dir = get_project_dir(project_id)
    written = write_files_safely(project_dir, technology, files)
    _log_event(project_dir, event_type=event_type, files=written, reasoning=reasoning)
    return written


def list_projects() -> list[dict]:
    """Summary of every project in storage, most recently touched first, for
    the frontend's project-history sidebar. Reads only the two bookkeeping
    files per project, never the generated sources -- this is called on every
    page load and shouldn't pay for reading whole projects off disk."""
    if not PROJECTS_DIR.exists():
        return []

    projects = []
    for project_dir in sorted(PROJECTS_DIR.iterdir()):
        if not project_dir.is_dir():
            continue
        try:
            requirement = json.loads((project_dir / "requirement.json").read_text(encoding="utf-8"))
            history = json.loads((project_dir / "history.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            # A directory without readable bookkeeping (interrupted create_project,
            # or something copied in by hand) shouldn't break the whole sidebar.
            continue
        # Any event beyond the initial "project_created" means files were
        # actually written -- a project with only that one event is a bare
        # scaffold whose generation never completed, and its preview would
        # just show the placeholder entry file.
        event_types = {event.get("event_type") for event in history}
        projects.append({
            "project_id": project_dir.name,
            "app_name": requirement.get("appName") or project_dir.name,
            "technology": requirement.get("technology", "react"),
            "generated": bool(event_types - {"project_created"}),
            "created_at": history[0]["timestamp"] if history else None,
            "updated_at": history[-1]["timestamp"] if history else None,
        })

    projects.sort(key=lambda p: p["updated_at"] or "", reverse=True)
    return projects


def list_generated_files(project_id: str) -> dict[str, str]:
    """Every text file in the project except internal bookkeeping, keyed by
    path relative to the project root with forward slashes."""
    project_dir = get_project_dir(project_id)
    result: dict[str, str] = {}
    for path in project_dir.rglob("*"):
        if path.is_dir():
            continue
        rel = path.relative_to(project_dir).as_posix()
        if rel in INTERNAL_FILES:
            continue
        try:
            result[rel] = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
    return result


def read_history(project_id: str) -> list[dict]:
    project_dir = get_project_dir(project_id)
    return json.loads((project_dir / "history.json").read_text(encoding="utf-8"))


def read_requirement(project_id: str) -> dict:
    project_dir = get_project_dir(project_id)
    return json.loads((project_dir / "requirement.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    pid = create_project("react", {"technology": "react", "appName": "SmokeTest"})
    print("created project:", pid)

    apply_generated_files(
        pid, "react",
        files={"src/components/Hello.jsx": "export default function Hello() { return <div>Hi</div> }"},
        event_type="initial_generation",
        reasoning="Smoke test file.",
    )

    files = list_generated_files(pid)
    print("files:", sorted(files.keys()))
    print("history:", json.dumps(read_history(pid), indent=2))

    shutil.rmtree(get_project_dir(pid))
    print("cleaned up.")
