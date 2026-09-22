"""FastAPI entrypoint for the AI UI Generator backend."""
import base64
import io
import urllib.request
import zipfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from google.genai import errors as genai_errors
from pydantic import BaseModel

from services import change_planner, file_generator, llm_client, project_manager, requirement_parser
from services.document_extractor import ExtractionError, extract_text_from_pdf, extract_text_from_txt
from services.llm_client import LLMResponseError
from services.openapi_parser import OpenAPIParseError, parse_openapi_spec
from services.secure_file_ops import UnsafePathError

app = FastAPI(title="AI UI Generator")

# Vite's dev server is supposed to stay pinned to 5173 (see frontend/vite.config.js's
# strictPort: true), but list a couple of neighboring ports too as a safety net in case
# a stale process is still holding 5173 and Vite falls back to the next one.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:5174", "http://127.0.0.1:5174",
        "http://localhost:5175", "http://127.0.0.1:5175",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(genai_errors.APIError)
async def genai_error_handler(request, exc: genai_errors.APIError):
    # IMPORTANT: an exception that propagates unhandled past the router is turned
    # into a response by Starlette's outermost ServerErrorMiddleware, which sits
    # OUTSIDE CORSMiddleware -- that response never gets CORS headers, so the
    # browser's fetch() rejects with an opaque "Failed to fetch" instead of a
    # readable error (confirmed by testing in an actual browser; curl doesn't
    # enforce CORS, so this only shows up there). Registering handlers keeps the
    # response flowing through CORSMiddleware normally.
    return JSONResponse(
        status_code=502,
        content={"detail": f"The AI model is temporarily unavailable ({exc.status}). Please try again."},
    )


@app.exception_handler(LLMResponseError)
async def llm_response_error_handler(request, exc: LLMResponseError):
    return JSONResponse(
        status_code=502,
        content={"detail": f"The AI model failed to produce a usable response: {exc}"},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": f"Unexpected server error: {exc}"})

ENTRY_FILE = {"react": "src/App.jsx", "nextjs": "app/page.jsx"}


class UxReference(BaseModel):
    """Mirrors /api/uploads/ux-reference's response shape -- the frontend
    posts a file there first, then passes the result straight through here."""
    kind: str  # "text" | "html" | "image"
    filename: str
    text: str | None = None
    html: str | None = None
    mime_type: str | None = None
    data_base64: str | None = None


class CreateProjectRequest(BaseModel):
    requirement_text: str
    technology: str
    additional_instructions: str | None = None
    uploaded_text: str | None = None
    uploaded_filename: str | None = None
    uploaded_data_fields: list[dict] | None = None
    # Developer-facing (not shown in the main user-facing flow -- see
    # RequirementInput.jsx's collapsed "Developer settings" section), appended
    # onto the default system prompts for this project. Scoped per-project:
    # stored on this project's own requirement.json and reused for every
    # later feedback iteration on it, never applied to other projects.
    developer_system_prompt: str | None = None
    # UX/design reference upload -- a separate feature from uploaded_data_fields
    # above (OpenAPI spec upload). See UxReference and /api/uploads/ux-reference.
    ux_reference: UxReference | None = None


class FeedbackRequest(BaseModel):
    feedback_text: str


@app.get("/api/gemini/retry-status")
def gemini_retry_status():
    """Polled by the frontend while a generation/feedback request is in
    flight, to show "retrying" instead of a generic spinner during the
    backend's own retry-on-503 window (see services/llm_client.py)."""
    return llm_client.get_retry_status()


@app.get("/api/gemini/health")
def gemini_health():
    """Cheap reachability check (model metadata fetch, not a generation) for
    a small always-visible status indicator in the UI."""
    is_up, detail = llm_client.check_health()
    return {"up": is_up, "detail": detail}


_tailwind_cdn_cache: str | None = None


@app.get("/api/tailwind-cdn")
def tailwind_cdn():
    """Proxies the Tailwind Play CDN script, fetched once here and cached for
    the life of the process.

    WebContainerPreview injects a Tailwind script into generated Next.js apps
    so they render styled without a real build step. That works as a normal
    <script src="https://cdn.tailwindcss.com"> for the React Live preview, but
    WebContainers' own preview host sends `Cross-Origin-Embedder-Policy:
    require-corp` on every page it serves -- independent of anything this
    app's own vite.config.js sets -- and cdn.tailwindcss.com sends neither
    CORS nor CORP response headers. So that same script tag is silently
    blocked inside a WebContainer-hosted page (confirmed via
    ERR_BLOCKED_BY_RESPONSE...Coep in the browser console), leaving every
    Next.js preview completely unstyled.

    Fetching the script server-side (a plain request, not subject to any
    browser-side CORS/COEP restriction) and having the frontend inline its
    text directly into the generated page sidesteps the problem: an inline
    <script>...</script> has no network request of its own for COEP to
    block.
    """
    global _tailwind_cdn_cache
    if _tailwind_cdn_cache is None:
        # cdn.tailwindcss.com 403s a request with urllib's default (no)
        # User-Agent -- confirmed empirically. A generic browser UA satisfies it.
        request = urllib.request.Request(
            "https://cdn.tailwindcss.com", headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(request, timeout=10) as resp:
            _tailwind_cdn_cache = resp.read().decode("utf-8")
    return Response(content=_tailwind_cdn_cache, media_type="text/javascript")


@app.post("/api/uploads/parse")
async def parse_upload(file: UploadFile = File(...)):
    """For the 'Upload API spec for data fields' control: an OpenAPI/Swagger
    spec (structured dataFields extraction), or a .txt/.pdf whose extracted
    text is folded into the typed requirement description. Distinct from
    /api/uploads/ux-reference below -- that one is for visual/structural
    design reference material, a separate feature. .txt and .pdf are accepted
    by both endpoints; which one a file is posted to is what determines how
    it's used, not anything about the file itself."""
    filename = file.filename or "upload"
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content = await file.read()

    if suffix in ("yaml", "yml", "json"):
        try:
            data_fields, warnings = parse_openapi_spec(content.decode("utf-8"), filename)
        except (OpenAPIParseError, UnicodeDecodeError) as e:
            raise HTTPException(400, f"Could not parse {filename!r} as an OpenAPI/Swagger spec: {e}")
        return {"kind": "openapi", "filename": filename, "data_fields": data_fields, "warnings": warnings}

    if suffix == "txt":
        return {"kind": "text", "filename": filename, "text": extract_text_from_txt(content), "warnings": []}

    if suffix == "pdf":
        try:
            text = extract_text_from_pdf(content)
        except ExtractionError as e:
            raise HTTPException(422, str(e))
        return {"kind": "text", "filename": filename, "text": text, "warnings": []}

    raise HTTPException(400, f"Unsupported file type: {filename!r}. Use .yaml, .json, .txt, or .pdf.")


UX_REFERENCE_MAX_BYTES = 8 * 1024 * 1024
UX_REFERENCE_IMAGE_MIME_TYPES = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}


@app.post("/api/uploads/ux-reference")
async def parse_ux_reference(file: UploadFile = File(...)):
    """For the 'Upload UX/design reference' control (replaces the old free-text
    'Describe the UI you want' box): a PDF/.txt/.html/.png/.jpg the UI should
    be visually or structurally adapted from. A separate feature from
    /api/uploads/parse above -- see its docstring for how .txt/.pdf overlap
    between the two is resolved (by which endpoint the file is posted to)."""
    filename = file.filename or "upload"
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content = await file.read()

    if len(content) > UX_REFERENCE_MAX_BYTES:
        raise HTTPException(
            400, f"{filename!r} is too large (max {UX_REFERENCE_MAX_BYTES // (1024 * 1024)}MB)."
        )

    if suffix == "txt":
        return {"kind": "text", "filename": filename, "text": extract_text_from_txt(content)}

    if suffix == "pdf":
        try:
            text = extract_text_from_pdf(content)
        except ExtractionError as e:
            raise HTTPException(422, str(e))
        return {"kind": "text", "filename": filename, "text": text}

    if suffix == "html":
        return {"kind": "html", "filename": filename, "html": content.decode("utf-8", errors="replace")}

    if suffix in UX_REFERENCE_IMAGE_MIME_TYPES:
        return {
            "kind": "image",
            "filename": filename,
            "mime_type": UX_REFERENCE_IMAGE_MIME_TYPES[suffix],
            "data_base64": base64.b64encode(content).decode("ascii"),
        }

    raise HTTPException(400, f"Unsupported file type: {filename!r}. Use .pdf, .txt, .html, .png, or .jpg.")


@app.post("/api/projects")
def create_project(body: CreateProjectRequest):
    if body.technology not in ("react", "nextjs"):
        raise HTTPException(400, f"Unsupported technology: {body.technology!r}. Use 'react' or 'nextjs'.")

    has_typed_text = bool(body.requirement_text.strip())
    has_uploaded_text = bool((body.uploaded_text or "").strip())
    has_openapi_fields = bool(body.uploaded_data_fields)
    has_ux_reference = body.ux_reference is not None
    if not (has_typed_text or has_uploaded_text or has_openapi_fields or has_ux_reference):
        raise HTTPException(400, "Provide a UX/design reference upload, an OpenAPI/spec upload, or both.")

    combined_text = body.requirement_text
    if has_uploaded_text:
        label = body.uploaded_filename or "uploaded file"
        separator = "\n\n" if combined_text.strip() else ""
        combined_text = f"{combined_text}{separator}--- Additional content extracted from {label} ---\n{body.uploaded_text}"

    # ux_reference carries raw image bytes as base64 over JSON -- decode once
    # here into the {bytes, mime_type} shape requirement_parser/file_generator
    # expect; kept out of `requirement` itself (see requirement_parser.py) so
    # it's only ever used for this one request, never persisted to disk.
    ux_reference = None
    ux_reference_image: tuple[bytes, str] | None = None
    if body.ux_reference:
        ux_reference = body.ux_reference.model_dump()
        if body.ux_reference.kind == "image":
            image_bytes = base64.b64decode(body.ux_reference.data_base64)
            ux_reference["image_bytes"] = image_bytes
            ux_reference["image_mime_type"] = body.ux_reference.mime_type
            ux_reference_image = (image_bytes, body.ux_reference.mime_type)

    requirement = requirement_parser.parse_requirement(
        combined_text,
        body.technology,
        additional_instructions=body.additional_instructions,
        uploaded_data_fields=body.uploaded_data_fields,
        developer_system_prompt=body.developer_system_prompt,
        ux_reference=ux_reference,
    )

    sources = []
    if has_openapi_fields:
        sources.append(f"an uploaded OpenAPI/Swagger spec ({body.uploaded_filename or 'unnamed file'})")
    if has_uploaded_text:
        sources.append(f"text extracted from {body.uploaded_filename or 'an uploaded file'}")
    if has_ux_reference:
        sources.append(f"a UX/design reference upload ({body.ux_reference.filename})")
    if has_typed_text:
        sources.append("a typed description")
    if body.additional_instructions and body.additional_instructions.strip():
        sources.append("additional instructions")
    source_note = f"Requirement sourced from: {', '.join(sources)}." if sources else None

    project_id = project_manager.create_project(body.technology, requirement, source_note=source_note)

    entry_file = ENTRY_FILE[body.technology]
    current_files = project_manager.list_generated_files(project_id)
    try:
        generated = file_generator.generate_files(
            files_to_generate=[entry_file],
            requirement=requirement,
            current_files=current_files,
            technology=body.technology,
            ux_reference_image=ux_reference_image,
        )
        project_manager.apply_generated_files(
            project_id, body.technology, generated,
            event_type="initial_generation",
            reasoning=f"Generated {entry_file} from the parsed requirement.",
        )
    except (ValueError, UnsafePathError) as e:
        raise HTTPException(502, f"Initial generation failed: {e}")

    return {
        "project_id": project_id,
        "technology": body.technology,
        "requirement": requirement,
        "files": project_manager.list_generated_files(project_id),
    }


@app.post("/api/projects/{project_id}/retry")
def retry_project(project_id: str):
    """Re-attempts initial generation for a project whose first generation
    attempt failed (see project_manager.list_projects()'s `generated` flag --
    a project with only a 'project_created' history event and no
    'initial_generation'). Uses the requirement already stored on this
    project from when it was first created -- no retyping needed. Mirrors
    create_project's own initial-generation step and response shape."""
    try:
        requirement = project_manager.read_requirement(project_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, f"No project with id {project_id!r}")

    technology = requirement["technology"]
    entry_file = ENTRY_FILE[technology]
    current_files = project_manager.list_generated_files(project_id)
    try:
        generated = file_generator.generate_files(
            files_to_generate=[entry_file],
            requirement=requirement,
            current_files=current_files,
            technology=technology,
        )
        project_manager.apply_generated_files(
            project_id, technology, generated,
            event_type="initial_generation",
            reasoning=f"Retried generation of {entry_file} from the stored requirement.",
        )
    except (ValueError, UnsafePathError) as e:
        raise HTTPException(502, f"Retry failed: {e}")

    return {
        "project_id": project_id,
        "technology": technology,
        "requirement": requirement,
        "files": project_manager.list_generated_files(project_id),
    }


@app.post("/api/projects/{project_id}/approve")
def approve_project(project_id: str):
    """Snapshots the project's current files into storage/approved/{id}/,
    separate from the in-progress storage/projects/{id}/ copy (a copy, not a
    move -- the in-progress copy is unaffected)."""
    try:
        requirement = project_manager.approve_project(project_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, f"No project with id {project_id!r}")
    return {"project_id": project_id, "approved": True, "approved_at": requirement["approved_at"]}


@app.post("/api/projects/{project_id}/feedback")
def submit_feedback(project_id: str, body: FeedbackRequest):
    if not body.feedback_text.strip():
        raise HTTPException(400, "feedback_text must not be empty.")

    try:
        requirement = project_manager.read_requirement(project_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, f"No project with id {project_id!r}")

    technology = requirement["technology"]
    current_files = project_manager.list_generated_files(project_id)

    plan = change_planner.plan_changes(
        body.feedback_text, list(current_files.keys()), technology,
        developer_system_prompt=requirement.get("developer_system_prompt"),
    )
    if not plan["files_to_change"]:
        return {"changed_files": [], "reasoning": plan["reasoning"]}

    try:
        generated = file_generator.generate_files(
            files_to_generate=plan["files_to_change"],
            requirement=requirement,
            current_files=current_files,
            technology=technology,
            feedback_text=body.feedback_text,
        )
        written = project_manager.apply_generated_files(
            project_id, technology, generated,
            event_type="feedback_iteration",
            reasoning=plan["reasoning"],
        )
    except (ValueError, UnsafePathError) as e:
        raise HTTPException(502, f"Feedback iteration failed: {e}")

    return {"changed_files": written, "reasoning": plan["reasoning"]}


@app.get("/api/projects")
def list_projects():
    """Backs the project-history sidebar. Lists every project in storage as-is
    -- this tool has no draft/approved distinction, so there is nothing to
    filter on here."""
    return {"projects": project_manager.list_projects()}


@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    # TODO: real auth before this goes beyond local/personal use. For the MVP,
    # anyone who knows a project_id can read it -- project_id is an unguessable
    # random token, not a real access control mechanism.
    try:
        requirement = project_manager.read_requirement(project_id)
        files = project_manager.list_generated_files(project_id)
        history = project_manager.read_history(project_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, f"No project with id {project_id!r}")

    return {
        "project_id": project_id,
        "technology": requirement["technology"],
        "requirement": requirement,
        "files": files,
        "history": history,
    }


@app.get("/api/projects/{project_id}/export")
def export_project(project_id: str):
    try:
        project_dir = project_manager.get_project_dir(project_id)
        requirement = project_manager.read_requirement(project_id)
    except (FileNotFoundError, ValueError):
        raise HTTPException(404, f"No project with id {project_id!r}")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in project_dir.rglob("*"):
            if path.is_dir():
                continue
            rel = path.relative_to(project_dir).as_posix()
            if rel in project_manager.INTERNAL_FILES:
                continue
            zf.write(path, arcname=rel)
    buffer.seek(0)

    app_name = requirement.get("appName", project_id).replace(" ", "-")
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{app_name}.zip"'},
    )
