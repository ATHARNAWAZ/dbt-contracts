"""
services/claude_service.py — Stream contract YAML from Claude.

We use Server-Sent Events (SSE) so the frontend can display the contract
appearing token-by-token. This makes the generation feel fast even on longer
models with many columns — perception matters as much as latency.

SSE format (JSON payload per event):
  Chunk event:  data: {"chunk": "<text>", "done": false}\n\n
  Done event:   data: {"chunk": "", "done": true}\n\n
  Error event:  data: {"chunk": "", "done": true, "error": "<message>"}\n\n

Using JSON payloads means newlines inside the YAML chunk are safely embedded
in the JSON string — no need to split on newlines and emit multiple "data:"
field lines per event, which would require careful SSE reassembly on the
client side.
"""

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import anthropic

from app.config import get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt engineering
#
# The system prompt is tightly constrained to produce only valid YAML.
# We never ask for markdown fences or explanations — the raw YAML is what
# the downstream validator and editor need. Claude is instructed to use the
# exact schema so the validator downstream has minimal work to do.
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a senior data engineer generating data contracts for dbt models.
Output ONLY valid YAML. No markdown fences. No explanation text.
Be specific about thresholds based on column names and types:
- ID columns: unique: true, not_null: true
- Timestamp/date columns: add freshness check
- Amount/price/revenue columns: min: 0, reasonable max based on context
- Status/type/category columns: accepted_values (infer from column name context)
- Boolean columns: accepted_values: [true, false]
- Email columns: not_null based on whether it's a required field
Always output the full contract YAML structure with all fields populated.

Use this exact schema:

version: 1
model: {model_name}
description: "{auto-generated description based on model name and layer}"
owner: "{source for sources, staging for stg_, data-platform for marts}"
freshness:
  warn_after_hours: 24
  error_after_hours: 48
row_count:
  min: 100
  warn_below: 1000
columns:
  {column_name}:
    not_null: true/false
    unique: true/false
    accepted_values: []
    min: null
    max: null
    warn_if_null_rate_above: 0.05

Additional layer-specific rules:
- staging (stg_) freshness: warn_after_hours 6, error_after_hours 12; row_count min null, warn_below null
- intermediate (int_) freshness: warn_after_hours 12, error_after_hours 24; row_count min null, warn_below 50
- mart/fct/dim freshness: warn_after_hours 24, error_after_hours 48; row_count min 10, warn_below 100

Generate contracts that a careful data engineer would be proud to ship.
Start your response with "version: 1" and end with the last YAML line.
"""


def _build_user_message(model_data: dict[str, Any]) -> str:
    """
    Construct the user-facing message Claude will respond to.

    We serialise the model metadata as YAML-like text rather than JSON because
    it's more natural for a prompt that asks Claude to produce YAML contracts.
    """
    name = model_data.get("name", "unknown")
    layer = model_data.get("layer", "unknown")
    description = model_data.get("description", "No description provided.")
    tags = model_data.get("tags", [])
    # Columns may be keyed by "columns" containing either ColumnInfo objects
    # serialised as dicts, or plain dicts forwarded from the frontend.
    columns = model_data.get("columns", {})

    lines = [
        f"Model name: {name}",
        f"Layer: {layer}",
        f"Description: {description}",
        f"Tags: {', '.join(tags) if tags else 'none'}",
        "",
        "Columns:",
    ]

    for col_name, col_info in columns.items():
        col_desc = col_info.get("description", "") if isinstance(col_info, dict) else ""
        col_type = col_info.get("data_type", "") if isinstance(col_info, dict) else ""
        lines.append(f"  - {col_name} ({col_type}): {col_desc}")

    return "\n".join(lines)


def _sse_chunk(text: str, done: bool = False) -> str:
    """
    Format a single SSE event carrying a YAML text chunk.

    Payload:  data: {"chunk": "...", "done": false}\\n\\n

    The double newline terminates the event per the SSE specification (RFC 8895).
    Using JSON means any newlines inside the YAML chunk are escaped inside the
    JSON string, so the event is always exactly one line — no multi-field SSE
    reassembly required on the client.
    """
    payload = json.dumps({"chunk": text, "done": done})
    return f"data: {payload}\n\n"


def _sse_error(message: str) -> str:
    """
    Format an SSE error event that also signals the stream is finished.

    Payload:  data: {"chunk": "", "done": true, "error": "..."}\\n\\n
    """
    payload = json.dumps({"chunk": "", "done": True, "error": message})
    return f"data: {payload}\n\n"


async def stream_contract_generation(
    model_data: dict[str, Any],
) -> AsyncGenerator[str, None]:
    """
    Yield SSE-formatted strings of the contract YAML as Claude generates it.

    Each yielded string is a complete SSE event terminated by a blank line.
    The generator never raises: all error paths produce a terminal [ERROR]
    event so the frontend always receives a clean end-of-stream signal.

    Chunk events:  data: {"chunk": "<yaml text>", "done": false}\\n\\n
    Done event:    data: {"chunk": "", "done": true}\\n\\n
    Error events:  data: {"chunk": "", "done": true, "error": "<msg>"}\\n\\n

    The caller is responsible for wrapping this in an EventSourceResponse —
    see routers/contracts.py.
    """
    settings = get_settings()
    api_key = settings.anthropic_api_key
    model_name = model_data.get("name", "unknown")

    # Guard: an empty/whitespace-only key produces a confusing 401 deep inside
    # the streaming setup. Catch it here for a clear, actionable error message.
    if not api_key or not api_key.strip():
        logger.warning(
            "ANTHROPIC_API_KEY is not configured; cannot generate contract for model: %s",
            model_name,
        )
        yield _sse_error("Claude API key is not configured on this server.")
        return

    client = anthropic.AsyncAnthropic(api_key=api_key)
    user_message = _build_user_message(model_data)

    logger.info("Starting Claude contract generation for model: %s", model_name)

    try:
        async with client.messages.stream(
            model=settings.claude_model,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        ) as stream:
            async for text_chunk in stream.text_stream:
                yield _sse_chunk(text_chunk, done=False)

        # Signal the frontend that streaming completed successfully.
        yield _sse_chunk("", done=True)
        logger.info("Claude contract generation complete for model: %s", model_name)

    except anthropic.AuthenticationError:
        # HTTP 401 — key is syntactically valid but rejected by Anthropic.
        logger.error(
            "Claude authentication failed (invalid or revoked key) for model: %s", model_name
        )
        yield _sse_error("Claude API key is invalid or has been revoked.")

    except anthropic.PermissionDeniedError:
        # HTTP 403 — key exists but lacks access to the requested model/resource.
        logger.error(
            "Claude permission denied for model %s (check model access tier)", model_name
        )
        yield _sse_error(
            "Claude API key does not have access to the requested model. "
            "Check your Anthropic account tier."
        )

    except anthropic.RateLimitError:
        # HTTP 429 — requests per minute or tokens per day quota exceeded.
        logger.warning(
            "Claude rate limit hit while generating contract for model: %s", model_name
        )
        yield _sse_error("Claude rate limit reached. Please wait a moment and try again.")

    except anthropic.APIStatusError as exc:
        # Catch-all for other 4xx/5xx HTTP errors returned by the Anthropic API.
        logger.error(
            "Claude API HTTP %s error for model %s: %s",
            exc.status_code,
            model_name,
            exc.message,
        )
        yield _sse_error(
            f"Claude API returned HTTP {exc.status_code}. "
            "Check your API key and account quota."
        )

    except anthropic.APITimeoutError:
        # The request timed out before the first response byte arrived.
        logger.error("Claude API request timed out for model: %s", model_name)
        yield _sse_error(
            "Claude API request timed out. Try again — large models with many columns "
            "can occasionally exceed the timeout."
        )

    except anthropic.APIConnectionError as exc:
        # Network-level failure: DNS resolution, TLS handshake, connection reset.
        logger.error("Claude connection error for model %s: %s", model_name, exc)
        yield _sse_error(
            "Could not connect to the Claude API. Check your server's network connectivity."
        )

    except Exception as exc:  # noqa: BLE001  # intentional broad catch for generator safety
        # Any unexpected exception must be caught here. If the generator raises
        # instead of yielding, the SSE connection is torn down without a terminal
        # event and the frontend will hang waiting for [DONE].
        logger.exception(
            "Unexpected error during Claude contract generation for model: %s", model_name
        )
        yield _sse_error(f"Unexpected server error: {type(exc).__name__}.")
