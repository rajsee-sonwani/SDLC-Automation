"""
Extracts plain text from uploaded .txt and .pdf files, for feeding into the
existing text-based requirement pipeline alongside (not instead of) the
typed "Describe the UI" text.
"""
from io import BytesIO

from pypdf import PdfReader

# Below this many non-whitespace characters, treat a PDF as effectively
# unextractable (e.g. a scanned/image-based PDF with no text layer) rather
# than silently forwarding near-empty content to the LLM.
MIN_USABLE_CHARS = 20


class ExtractionError(ValueError):
    """Raised when text couldn't be usefully extracted from the file."""


def extract_text_from_txt(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("utf-8", errors="replace")


def extract_text_from_pdf(content: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(content))
        pages_text = [page.extract_text() or "" for page in reader.pages]
    except Exception as e:
        raise ExtractionError(f"Could not read this PDF: {e}") from e

    text = "\n\n".join(pages_text).strip()
    if len(text.replace(" ", "").replace("\n", "")) < MIN_USABLE_CHARS:
        raise ExtractionError(
            "No usable text could be extracted from this PDF -- it may be a scanned/image-based "
            "PDF with no text layer. Try a text-based PDF, or paste the content directly into the "
            "description box instead."
        )
    return text
