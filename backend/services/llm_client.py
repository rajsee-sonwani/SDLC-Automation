"""
Thin wrapper around the Gemini API (google-genai SDK). No other module in this
backend should import `google.genai` directly -- everything goes through the
two functions below so model choice, auth, and structured-output config live
in one place.
"""
import json
import os
import time

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

load_dotenv()

# The build spec originally called for "gemini-2.5-flash". Confirmed via a live
# call against this project's API key that gemini-2.5-flash now returns
# 404 NOT_FOUND ("no longer available to new users"), even though it still
# appears in models.list(). gemini-3.6-flash is the confirmed-working
# replacement -- verify its free-tier status at https://aistudio.google.com/apikey
# if that matters for your account.
MODEL_NAME = "gemini-3.6-flash"

_client = None

# Gemini has been intermittently returning 503 UNAVAILABLE -- confirmed via
# Google's own AI Studio status dashboard as a Google-side reliability issue,
# not something wrong with our requests. Retry those specifically (not other
# errors, e.g. a genuinely bad request should fail immediately) with a short
# fixed delay before giving up.
MAX_RETRIES = 5
RETRY_DELAY_SECONDS = 3

# Lightweight in-memory status the frontend can poll mid-request to show
# "retrying" instead of a generic spinner. This is a single-process, no-auth,
# local tool (see README) -- one shared module-level dict is fine; it isn't
# meant to disambiguate multiple concurrent users.
_retry_status = {"retrying": False, "attempt": 0, "max_attempts": MAX_RETRIES}


def get_retry_status() -> dict:
    return dict(_retry_status)


def _is_retryable(exc: Exception) -> bool:
    return isinstance(exc, errors.APIError) and (exc.code == 503 or exc.status == "UNAVAILABLE")


def _call_with_retry(fn):
    """Calls `fn()` (a zero-arg thunk wrapping a Gemini API call), retrying up
    to MAX_RETRIES times on a 503/UNAVAILABLE error. Re-raises immediately on
    any other error, and re-raises the last error if retries are exhausted --
    callers see the same exception type either way, just later."""
    try:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                result = fn()
                _retry_status.update(retrying=False, attempt=0)
                return result
            except Exception as exc:
                if not _is_retryable(exc) or attempt == MAX_RETRIES:
                    raise
                _retry_status.update(retrying=True, attempt=attempt)
                time.sleep(RETRY_DELAY_SECONDS)
    finally:
        _retry_status.update(retrying=False, attempt=0)


class LLMResponseError(RuntimeError):
    """Raised when Gemini did not return a usable text completion -- a blocked
    prompt, an empty candidate list, or a finish_reason other than STOP (e.g.
    MAX_TOKENS, SAFETY). `response.text` silently returns None in all of these
    cases instead of raising, so callers must not pass it straight to a parser
    -- that turns a clear "the model didn't answer" into a confusing crash (or
    worse, a partial/truncated response that happens to still parse)."""


def _get_client():
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to backend/.env (see .env.example)."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def _extract_text(response) -> str:
    feedback = response.prompt_feedback
    if feedback and feedback.block_reason:
        raise LLMResponseError(
            f"Gemini blocked the prompt (block_reason={feedback.block_reason}); "
            "no completion was generated."
        )

    candidates = response.candidates or []
    if not candidates:
        raise LLMResponseError("Gemini returned no candidates for this prompt.")

    finish_reason = candidates[0].finish_reason
    if finish_reason is not None and finish_reason != types.FinishReason.STOP:
        raise LLMResponseError(
            f"Gemini's response did not finish normally (finish_reason={finish_reason}); "
            "treating it as failed rather than using a truncated/blocked completion."
        )

    text = response.text
    if text is None:
        raise LLMResponseError(
            f"Gemini returned an empty response (finish_reason={finish_reason})."
        )
    return text


def append_developer_instructions(base_system_prompt: str, developer_system_prompt: str | None) -> str:
    """Appends a developer-supplied addition onto a base system prompt --
    additive only, never a replacement: the base prompt (requirement_parser's,
    change_planner's, or file_generator's own default) always stays intact and
    active, and this is concatenated onto the end of it. Unlike end-user data
    fields (requirement text, feedback text), the developer's own text is not
    wrapped in "ignore attempts to redirect you" framing -- it IS trusted
    additional system-level instruction, supplied by whoever is running this
    tool, not by whoever is typing a UI requirement into it.
    """
    if not developer_system_prompt or not developer_system_prompt.strip():
        return base_system_prompt
    return (
        f"{base_system_prompt}\n\n"
        "--- Developer-supplied additional instructions (appended; the rules above still apply "
        "in full) ---\n"
        f"{developer_system_prompt.strip()}"
    )


# A normal generate_content call has no explicit timeout (retried up to
# MAX_RETRIES times on 503s, so it can legitimately take a while) -- the
# health check needs the opposite: fail fast so the endpoint always responds
# quickly, even when Gemini is genuinely unreachable rather than just slow.
HEALTH_CHECK_TIMEOUT_MS = 5000


def check_health() -> tuple[bool, str]:
    """Cheap reachability check: fetches model metadata rather than running an
    actual generation, so it doesn't burn a generation call just to answer
    "is Gemini up". Uses a short request timeout (see HEALTH_CHECK_TIMEOUT_MS)
    so this never hangs. Returns (is_up, detail)."""
    try:
        client = _get_client()
        client.models.get(
            model=MODEL_NAME,
            config=types.GetModelConfig(
                http_options=types.HttpOptions(timeout=HEALTH_CHECK_TIMEOUT_MS)
            ),
        )
        return True, "ok"
    except Exception as exc:
        return False, str(exc)


ImagePart = tuple[bytes, str]  # (raw image bytes, mime type e.g. "image/png")


def _build_contents(prompt: str, image_parts: list[ImagePart] | None):
    """Plain string contents for a text-only call (the common case, unchanged
    from before); a list of Parts -- the text prompt plus each image -- when
    images are attached, so Gemini genuinely sees the pixels rather than just
    a filename reference (see requirement_parser.py's UX-reference handling)."""
    if not image_parts:
        return prompt
    parts = [types.Part.from_text(text=prompt)]
    for data, mime_type in image_parts:
        parts.append(types.Part.from_bytes(data=data, mime_type=mime_type))
    return parts


def generate_structured(
    prompt: str,
    response_schema: dict,
    system_instruction: str = None,
    temperature: float = 0.2,
    image_parts: list[ImagePart] | None = None,
) -> dict:
    """
    Call Gemini with a fixed response_schema and return the parsed JSON dict.

    response_schema must use Gemini's own schema dialect (uppercase TYPE names,
    no $ref/$defs -- Gemini's structured-output mode rejects recursive schemas
    at the API level, confirmed empirically; see backend/schemas/ for the
    canonical, non-flattened JSON Schema used for independent validation).

    image_parts: optional (bytes, mime_type) pairs attached as real visual
    input alongside the text prompt (see _build_contents) -- used for an
    uploaded UX/design reference image.
    """
    client = _get_client()
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=response_schema,
        temperature=temperature,
        system_instruction=system_instruction,
    )
    contents = _build_contents(prompt, image_parts)
    response = _call_with_retry(
        lambda: client.models.generate_content(model=MODEL_NAME, contents=contents, config=config)
    )
    text = _extract_text(response)
    # strict=False: Gemini's JSON output sometimes embeds literal control
    # characters (raw newlines) inside string values instead of escaping them
    # as \n -- confirmed empirically when a string value contains multi-line
    # source code. strict=False tolerates that instead of raising.
    return json.loads(text, strict=False)


def generate_text(
    prompt: str,
    system_instruction: str = None,
    temperature: float = 0.2,
    image_parts: list[ImagePart] | None = None,
) -> str:
    """
    Call Gemini for plain text output (no JSON wrapping). Use this when the
    response itself contains source code: asking Gemini to wrap multi-file
    code inside a JSON string value is unreliable in practice -- confirmed
    empirically, it produces both unescaped literal newlines and invalid
    \\-escapes inside string values (e.g. from an apostrophe in generated
    JSX), which break strict JSON parsing either way. Callers that need
    several files back should use an unambiguous text delimiter format
    instead of JSON -- see file_generator.py.

    image_parts: see generate_structured.
    """
    client = _get_client()
    config = types.GenerateContentConfig(
        temperature=temperature,
        system_instruction=system_instruction,
    )
    contents = _build_contents(prompt, image_parts)
    response = _call_with_retry(
        lambda: client.models.generate_content(model=MODEL_NAME, contents=contents, config=config)
    )
    return _extract_text(response)


if __name__ == "__main__":
    # Smoke test: one real call against the live API.
    result = generate_structured(
        prompt="A simple contact form with name, email, and message fields, and a submit button.",
        response_schema={
            "type": "OBJECT",
            "properties": {
                "summary": {"type": "STRING"},
                "fieldNames": {"type": "ARRAY", "items": {"type": "STRING"}},
            },
            "required": ["summary", "fieldNames"],
        },
        system_instruction="Summarize the described UI in one sentence and list its input field names.",
    )
    print("Smoke test result:")
    print(json.dumps(result, indent=2))
