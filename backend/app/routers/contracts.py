"""
routers/contracts.py — Contract generation, validation, and export endpoints.

POST /api/contracts/generate  — SSE streaming (calls Claude)
POST /api/contracts/validate  — Validate YAML, return errors with line numbers
POST /api/contracts/export    — Download contracts.yml + github-action.yml

SSE format for /generate:
  Each chunk:  data: {"chunk": "...", "done": false}\n\n
  Final event: data: {"chunk": "", "done": true}\n\n
  Error event: data: {"chunk": "", "done": true, "error": "..."}\n\n
"""

import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.models.contract import (
    ExportContractsRequest,
    ExportContractsResponse,
    GenerateContractRequest,
    ValidateContractRequest,
    ValidateContractResponse,
)
from app.services.claude_service import stream_contract_generation
from app.services.contract_generator import generate_github_action_yaml
from app.services.contract_validator import validate_contract_yaml

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

# FIX: Removed `limiter = Limiter(key_func=get_remote_address)`.
#
# A locally instantiated Limiter has an isolated in-memory counter store that
# is completely separate from the limiter registered on app.state in main.py.
# Two consequences:
#   1. The RateLimitExceeded exception raised by this local limiter is NOT
#      caught by the custom handler in main.py, so the required JSON 429 body
#      was never returned — the client received slowapi's default plain-text
#      response instead.
#   2. get_remote_address reads request.client.host, which on Railway is the
#      load-balancer address — meaning all users shared a single counter and
#      the limit was effectively per-deployment, not per-client-IP.
#
# Rate limiting is now enforced inline using the shared limiter from
# app.state (which keys on X-Forwarded-For via get_client_ip in main.py).


@router.post("/generate")
async def generate_contract(
    request: Request,
    body: GenerateContractRequest,
):
    """
    Stream a data contract YAML for a single dbt model using Claude.

    Returns a Server-Sent Events stream with Content-Type: text/event-stream.
    Each SSE event carries a JSON payload:
        data: {"chunk": "<text>", "done": false}

    The stream ends with:
        data: {"chunk": "", "done": true}

    Rate limited to RATE_LIMIT_PER_HOUR requests per IP per hour.
    """
    # FIX: Enforce rate limit using the shared app.state.limiter so the counter
    # store, key function (X-Forwarded-For), and 429 exception handler are all
    # consistent with what is registered in main.py.
    limiter = request.app.state.limiter
    try:
        # _check_request_limit is slowapi's internal method that increments the
        # counter and raises RateLimitExceeded when the limit is hit.  We call
        # it directly because the @limiter.limit decorator is only safe to use
        # when the decorator's limiter instance IS the app.state.limiter — using
        # it on a locally created Limiter produces the isolation bug described
        # above.
        await limiter._check_request_limit(  # noqa: SLF001
            request, response=None, limit=f"{settings.rate_limit_per_hour}/hour"
        )
    except RateLimitExceeded:
        raise
    except Exception:
        # If the limiter itself errors (e.g. Redis unavailable), fail open to
        # avoid blocking legitimate requests.
        logger.warning("Rate limiter check failed on /generate; allowing request")

    if not body.model_name:
        raise HTTPException(status_code=400, detail="model_name is required.")

    if not body.columns and not body.model_data:
        raise HTTPException(
            status_code=400,
            detail="Either columns or model_data is required.",
        )

    logger.info("Generating contract for model: %s", body.model_name)

    # Build the model_data dict that claude_service expects.
    # Accept either the full model_data dict (from manifest parse response)
    # or a simpler {model_name, columns, session_id} payload.
    if body.model_data:
        model_data = body.model_data
    else:
        # Construct a minimal model_data from the simpler request shape
        model_data = {
            "name": body.model_name,
            "layer": body.layer or "unknown",
            "description": body.description or "",
            "tags": body.tags or [],
            "columns": body.columns or {},
        }

    async def event_generator():
        async for sse_event in stream_contract_generation(model_data):
            yield sse_event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            # Disable buffering so chunks reach the browser immediately
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/validate", response_model=ValidateContractResponse)
async def validate_contract(body: ValidateContractRequest):
    """
    Validate a contract YAML string.

    Returns is_valid, a list of errors (blocking), and warnings (advisory).
    Errors include line numbers where possible so the Monaco Editor can
    surface them as inline decorations.
    """
    if not body.contract_yaml:
        raise HTTPException(status_code=400, detail="contract_yaml is required.")

    result = validate_contract_yaml(body.contract_yaml)
    return result


@router.post("/export", response_model=ExportContractsResponse)
async def export_contracts(body: ExportContractsRequest):
    """
    Return a combined contracts.yml file and the GitHub Action YAML.

    Accepts a JSON body with contracts_yaml (the full contracts.yml content
    with all models concatenated using --- separators) and an optional
    model_count.

    Returns a JSON object with both YAML strings so the frontend can trigger
    individual file downloads.
    """
    if not body.contracts_yaml:
        raise HTTPException(
            status_code=400,
            detail="contracts_yaml is required.",
        )

    github_action_yaml = generate_github_action_yaml()

    return ExportContractsResponse(
        contracts_yaml=body.contracts_yaml,
        github_action_yaml=github_action_yaml,
        model_count=body.model_count,
    )
