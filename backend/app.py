"""FastAPI entrypoint for the AI UI Generator backend."""
import io
import zipfile

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from google.genai import errors as genai_errors
from pydantic import BaseModel

from services import change_planner, file_generator, project_manager, requirement_parser
from services.llm_client import LLMResponseError
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


class CreateProjectRequest(BaseModel):
    requirement_text: str
    technology: str


class FeedbackRequest(BaseModel):
    feedback_text: str


@app.post("/api/projects")
def create_project(body: CreateProjectRequest):
    if body.technology not in ("react", "nextjs"):
        raise HTTPException(400, f"Unsupported technology: {body.technology!r}. Use 'react' or 'nextjs'.")
    if not body.requirement_text.strip():
        raise HTTPException(400, "requirement_text must not be empty.")

    requirement = requirement_parser.parse_requirement(body.requirement_text, body.technology)
    project_id = project_manager.create_project(body.technology, requirement)

    entry_file = ENTRY_FILE[body.technology]
    current_files = project_manager.list_generated_files(project_id)
    try:
        generated = file_generator.generate_files(
            files_to_generate=[entry_file],
            requirement=requirement,
            current_files=current_files,
            technology=body.technology,
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

    plan = change_planner.plan_changes(body.feedback_text, list(current_files.keys()), technology)
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
