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
import uuid
from datetime import datetime, timezone
from pathlib import Path

from services.secure_file_ops import write_files_safely

BACKEND_DIR = Path(__file__).parent.parent
SCAFFOLDS_DIR = BACKEND_DIR.parent / "scaffolds"
PROJECTS_DIR = BACKEND_DIR / "storage" / "projects"

SCAFFOLD_BY_TECH = {"react": "react-vite", "nextjs": "nextjs"}

# Bookkeeping files project_manager itself writes at the project root -- not
# part of the generated app, excluded from file listings / exports / the
# change planner's view of "current files".
INTERNAL_FILES = {"history.json", "requirement.json"}
COPY_IGNORE = shutil.ignore_patterns("node_modules", ".next", "dist", "package-lock.json", ".git")

_PROJECT_ID_RE = re.compile(r"^[a-f0-9]{12}$")


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
    if not _PROJECT_ID_RE.match(project_id):
        raise ValueError(f"Invalid project_id: {project_id!r}")
    project_dir = PROJECTS_DIR / project_id
    if Path(os.path.realpath(project_dir)).parent != Path(os.path.realpath(PROJECTS_DIR)):
        raise ValueError(f"Invalid project_id: {project_id!r}")
    if not project_dir.exists():
        raise FileNotFoundError(f"No project with id {project_id!r}")
    return project_dir


def create_project(technology: str, requirement: dict) -> str:
    if technology not in SCAFFOLD_BY_TECH:
        raise ValueError(f"Unsupported technology: {technology!r}")

    project_id = uuid.uuid4().hex[:12]
    project_dir = PROJECTS_DIR / project_id
    scaffold_dir = SCAFFOLDS_DIR / SCAFFOLD_BY_TECH[technology]

    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copytree(scaffold_dir, project_dir, ignore=COPY_IGNORE)

    _init_history(project_dir)
    (project_dir / "requirement.json").write_text(json.dumps(requirement, indent=2), encoding="utf-8")
    _log_event(
        project_dir,
        event_type="project_created",
        files=[],
        reasoning=f"Created from the {SCAFFOLD_BY_TECH[technology]} scaffold for technology={technology}.",
    )
    return project_id


def apply_generated_files(project_id: str, technology: str, files: dict[str, str], event_type: str, reasoning: str) -> list[str]:
    project_dir = get_project_dir(project_id)
    written = write_files_safely(project_dir, technology, files)
    _log_event(project_dir, event_type=event_type, files=written, reasoning=reasoning)
    return written


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
