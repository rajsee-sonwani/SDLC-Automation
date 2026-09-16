"""
Thin wrapper around the Gemini API (google-genai SDK). No other module in this
backend should import `google.genai` directly -- everything goes through the
two functions below so model choice, auth, and structured-output config live
in one place.
"""
import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# The build spec originally called for "gemini-2.5-flash". Confirmed via a live
# call against this project's API key that gemini-2.5-flash now returns
# 404 NOT_FOUND ("no longer available to new users"), even though it still
# appears in models.list(). gemini-3.6-flash is the confirmed-working
# replacement -- verify its free-tier status at https://aistudio.google.com/apikey
# if that matters for your account.
MODEL_NAME = "gemini-3.6-flash"

_client = None


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


def generate_structured(prompt: str, response_schema: dict, system_instruction: str = None, temperature: float = 0.2) -> dict:
    """
    Call Gemini with a fixed response_schema and return the parsed JSON dict.

    response_schema must use Gemini's own schema dialect (uppercase TYPE names,
    no $ref/$defs -- Gemini's structured-output mode rejects recursive schemas
    at the API level, confirmed empirically; see backend/schemas/ for the
    canonical, non-flattened JSON Schema used for independent validation).
    """
    client = _get_client()
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=response_schema,
        temperature=temperature,
        system_instruction=system_instruction,
    )
    response = client.models.generate_content(model=MODEL_NAME, contents=prompt, config=config)
    text = _extract_text(response)
    # strict=False: Gemini's JSON output sometimes embeds literal control
    # characters (raw newlines) inside string values instead of escaping them
    # as \n -- confirmed empirically when a string value contains multi-line
    # source code. strict=False tolerates that instead of raising.
    return json.loads(text, strict=False)


def generate_text(prompt: str, system_instruction: str = None, temperature: float = 0.2) -> str:
    """
    Call Gemini for plain text output (no JSON wrapping). Use this when the
    response itself contains source code: asking Gemini to wrap multi-file
    code inside a JSON string value is unreliable in practice -- confirmed
    empirically, it produces both unescaped literal newlines and invalid
    \\-escapes inside string values (e.g. from an apostrophe in generated
    JSX), which break strict JSON parsing either way. Callers that need
    several files back should use an unambiguous text delimiter format
    instead of JSON -- see file_generator.py.
    """
    client = _get_client()
    config = types.GenerateContentConfig(
        temperature=temperature,
        system_instruction=system_instruction,
    )
    response = client.models.generate_content(model=MODEL_NAME, contents=prompt, config=config)
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
