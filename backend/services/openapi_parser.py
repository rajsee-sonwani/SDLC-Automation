"""
Parses an uploaded OpenAPI/Swagger spec (.yaml/.yml/.json) and maps its schema
properties into this project's `dataFields` array shape (name, type,
enumValues) -- the same shape requirement_parser.py asks Gemini to produce.

Kept separate from requirement_parser.py: this is plain structural parsing of
a well-defined format, not an LLM call, and mixing the two would blur which
parts of a parsed requirement came from deterministic parsing vs. model
inference.
"""
import json

import yaml

# Mirrors requirement_parser.DATA_FIELD_TYPES -- duplicated rather than
# imported to keep this module import-independent of the LLM-schema module.
_JSON_SCHEMA_TYPE_MAP = {
    "integer": "number",
    "number": "number",
    "boolean": "boolean",
}


class OpenAPIParseError(ValueError):
    """Raised when the uploaded file isn't parseable YAML/JSON, or doesn't
    look like an OpenAPI/Swagger document."""


def _load_spec(raw_text: str, filename: str) -> dict:
    try:
        if filename.lower().endswith(".json"):
            spec = json.loads(raw_text)
        else:
            spec = yaml.safe_load(raw_text)
    except (json.JSONDecodeError, yaml.YAMLError) as e:
        raise OpenAPIParseError(f"Could not parse {filename!r} as YAML/JSON: {e}") from e

    if not isinstance(spec, dict):
        raise OpenAPIParseError(f"{filename!r} does not contain a YAML/JSON object at its root.")
    if "openapi" not in spec and "swagger" not in spec:
        raise OpenAPIParseError(
            f"{filename!r} doesn't look like an OpenAPI/Swagger spec "
            "(no top-level 'openapi' or 'swagger' key)."
        )
    return spec


def _map_property_type(prop: dict) -> tuple[str, list[str]]:
    """Returns (dataFields type, enumValues) for one JSON Schema property."""
    if isinstance(prop.get("enum"), list) and prop["enum"]:
        return "enum", [str(v) for v in prop["enum"]]

    json_type = prop.get("type")
    fmt = prop.get("format", "")

    if json_type == "string" and fmt in ("date", "date-time"):
        return "date", []
    if json_type == "string":
        return "string", []
    if json_type in _JSON_SCHEMA_TYPE_MAP:
        return _JSON_SCHEMA_TYPE_MAP[json_type], []
    # object, array, $ref, or anything else we don't have a UI-primitive for.
    return "unknown", []


def _schemas_from_spec(spec: dict) -> dict:
    """Handles both OpenAPI 3 (`components.schemas`) and Swagger 2
    (`definitions`) locations."""
    if "openapi" in spec:
        return ((spec.get("components") or {}).get("schemas") or {})
    return spec.get("definitions") or {}


def parse_openapi_spec(raw_text: str, filename: str) -> tuple[list[dict], list[str]]:
    """
    Returns (dataFields, warnings).

    dataFields: list of {"name", "type", "enumValues"}, one per schema
    property across every schema in the spec. Names are prefixed with their
    owning schema (e.g. "User.email") to avoid collisions between schemas
    that share a property name but mean different things.

    warnings: human-readable notes about anything that couldn't be mapped
    cleanly (e.g. a schema with no `properties`, or a $ref this parser
    doesn't resolve) -- surfaced to the caller rather than silently dropped.
    """
    spec = _load_spec(raw_text, filename)
    schemas = _schemas_from_spec(spec)

    if not schemas:
        return [], [f"{filename!r} has no schemas under components.schemas/definitions to extract fields from."]

    data_fields: list[dict] = []
    warnings: list[str] = []

    for schema_name, schema in schemas.items():
        if not isinstance(schema, dict):
            continue
        properties = schema.get("properties")
        if not properties:
            warnings.append(f"Schema {schema_name!r} has no properties; skipped.")
            continue

        for prop_name, prop in properties.items():
            if not isinstance(prop, dict):
                continue
            if "$ref" in prop:
                warnings.append(
                    f"{schema_name}.{prop_name} is a $ref to another schema; "
                    "recorded as type 'unknown' since this parser doesn't resolve nested refs."
                )
                data_fields.append({"name": f"{schema_name}.{prop_name}", "type": "unknown", "enumValues": []})
                continue

            field_type, enum_values = _map_property_type(prop)
            data_fields.append({
                "name": f"{schema_name}.{prop_name}",
                "type": field_type,
                "enumValues": enum_values,
            })

    return data_fields, warnings
