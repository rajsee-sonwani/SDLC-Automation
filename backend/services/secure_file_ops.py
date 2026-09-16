"""
SECURITY CRITICAL: the only place in this backend allowed to write
AI-generated file content to disk.

Every path an LLM proposes is untrusted input. This module never trusts a
string-prefix check alone -- it resolves each path with os.path.realpath and
verifies the result actually lives inside the target project directory
(handles "..", symlinks, and absolute-path tricks that a naive prefix check
would miss). The whole batch is validated before anything is written, so a
single bad path fails the entire batch rather than partially applying it.
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger("secure_file_ops")

# Where AI-generated files are allowed to land, per technology. Anything
# outside these prefixes (e.g. package.json, next.config.js, vite.config.js)
# is scaffold territory and must never be touched by generated content.
ALLOWED_PREFIXES = {
    "react": ("src",),
    "nextjs": ("app", "components"),
}


class UnsafePathError(ValueError):
    pass


def _is_obviously_unsafe(raw_path: str) -> str | None:
    """Cheap rejection of the obvious traversal patterns, before we even
    touch the filesystem. Returns a reason string if unsafe, else None."""
    if not raw_path or not raw_path.strip():
        return "empty path"
    normalized = raw_path.replace("\\", "/")
    if ".." in normalized.split("/"):
        return "contains '..' path segment"
    if normalized.startswith("/"):
        return "leading '/' (absolute path)"
    if normalized.startswith("~"):
        return "leading '~' (home-directory expansion)"
    if os.path.isabs(raw_path):
        return "absolute path"
    return None


def validate_paths(project_dir: Path, technology: str, filepaths: list[str]) -> dict[str, Path]:
    """
    Validate every path in `filepaths` against `project_dir` for the given
    technology. Returns {original_path: resolved_absolute_Path} only if ALL
    paths pass. Raises UnsafePathError listing every violation otherwise --
    callers must not write any file from a batch that fails validation.
    """
    if technology not in ALLOWED_PREFIXES:
        raise UnsafePathError(f"Unknown technology: {technology!r}")

    allowed_prefixes = ALLOWED_PREFIXES[technology]
    project_root = Path(os.path.realpath(project_dir))

    violations: list[str] = []
    resolved: dict[str, Path] = {}

    for raw_path in filepaths:
        reason = _is_obviously_unsafe(raw_path)
        if reason:
            violations.append(f"{raw_path!r}: {reason}")
            continue

        normalized = raw_path.replace("\\", "/").lstrip("./")
        top_level = normalized.split("/", 1)[0]
        if top_level not in allowed_prefixes:
            violations.append(
                f"{raw_path!r}: not under an allowed prefix for {technology} "
                f"(allowed: {', '.join(allowed_prefixes)})"
            )
            continue

        candidate = project_root / normalized
        real_candidate = Path(os.path.realpath(candidate))

        try:
            real_candidate.relative_to(project_root)
        except ValueError:
            violations.append(
                f"{raw_path!r}: resolves outside the project directory "
                f"({real_candidate} is not under {project_root})"
            )
            continue

        resolved[raw_path] = real_candidate

    if violations:
        for v in violations:
            logger.warning("Rejected unsafe generated file path: %s", v)
        raise UnsafePathError(
            f"{len(violations)} unsafe path(s) rejected, no files written:\n" + "\n".join(violations)
        )

    return resolved


def write_files_safely(project_dir: Path, technology: str, files: dict[str, str]) -> list[str]:
    """
    Validate every path in `files` (filepath -> content) as a single batch,
    then write all of them. Returns the list of relative paths written.
    Raises UnsafePathError (writing nothing) if any path in the batch is unsafe.
    """
    resolved = validate_paths(project_dir, technology, list(files.keys()))

    written: list[str] = []
    for raw_path, real_path in resolved.items():
        real_path.parent.mkdir(parents=True, exist_ok=True)
        real_path.write_text(files[raw_path], encoding="utf-8")
        written.append(raw_path)

    return written


if __name__ == "__main__":
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        project_dir = Path(tmp)
        (project_dir / "src").mkdir()

        print("Valid batch:")
        write_files_safely(project_dir, "react", {"src/components/Button.jsx": "// ok"})
        print(" wrote:", list((project_dir / "src").rglob("*.jsx")))

        print("\nUnsafe batch (should reject all, write nothing):")
        try:
            write_files_safely(
                project_dir,
                "react",
                {
                    "src/components/Good.jsx": "// would be fine alone",
                    "../../etc/passwd": "malicious",
                    "package.json": "outside allowed prefix",
                },
            )
        except UnsafePathError as e:
            print(" rejected as expected:\n", e)
        print(" files after rejected batch:", list((project_dir / "src").rglob("*.jsx")))
