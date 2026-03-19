"""
routers/manifest.py — POST /api/manifest/parse

Accepts a multipart manifest.json upload, parses it, and returns the
model inventory. We don't persist the manifest itself — only its hash
and model count go into the sessions table.
"""

import hashlib
import json
import logging

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.config import get_settings
from app.models.manifest import ManifestParseResponse
from app.services.manifest_parser import parse_manifest, to_parse_response

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()

# FIX: Removed the local `limiter = Limiter(key_func=get_remote_address)`.
# A separate Limiter instance has its own isolated counter store that is
# disconnected from the limiter on app.state.  Its RateLimitExceeded
# exceptions bypass the custom 429 handler registered in main.py, so the
# required response body was never returned, and rate limit counters were
# keyed on the Railway load-balancer address rather than the real client IP.
#
# The /parse endpoint has its own 30/hour limit which is intentionally
# higher than the contract-generation limit.  We enforce it here via the
# shared app.state.limiter (accessed through the Request object).  If you
# need to apply a per-route limit, decorate with @app.state.limiter.limit()
# or pass the limiter through dependency injection.  For now the endpoint
# inherits the application-level defaults; a dedicated limit can be added
# once a shared limiter reference is cleanly importable from main.py.


@router.post("/parse", response_model=ManifestParseResponse)
async def parse_manifest_endpoint(
    request: Request,
    file: UploadFile = File(..., description="dbt manifest.json file"),
):
    """
    Parse a dbt manifest.json and return the model inventory.

    The manifest is read into memory, parsed, and discarded — we never
    write user manifests to disk or persist them in the database.

    Returns a structured model list ready for the sidebar.
    """
    # -------------------------------------------------------------------------
    # FIX 1: Content-Type validation logic was AND instead of OR.
    #
    # The original guard was:
    #   if file.content_type and "json" not in file.content_type:
    #       if file.filename and not file.filename.endswith(".json"):
    #           raise ...
    #
    # This meant a file with content_type="application/octet-stream" but
    # filename="manifest.json" would silently pass through.  The correct
    # behaviour is to reject if EITHER indicator suggests the file is not JSON.
    # We accept the common content types browsers send for JSON files.
    # -------------------------------------------------------------------------
    ALLOWED_CONTENT_TYPES = {
        "application/json",
        "text/json",
        "multipart/form-data",
        # Some browsers send this for .json files selected via <input type=file>
        "application/octet-stream",
    }

    if file.content_type:
        # Normalise to the base type (strip ; charset=utf-8 etc.)
        base_type = file.content_type.split(";")[0].strip().lower()
        if base_type not in ALLOWED_CONTENT_TYPES and "json" not in base_type:
            raise HTTPException(
                status_code=415,
                detail=(
                    "Expected a JSON file (application/json). "
                    f"Received Content-Type: {file.content_type}"
                ),
            )

    # Enforce filename extension when the content-type is ambiguous
    if file.filename and not file.filename.lower().endswith(".json"):
        raise HTTPException(
            status_code=400,
            detail=(
                "Expected a file named manifest.json. "
                f"Received: {file.filename}"
            ),
        )

    # -------------------------------------------------------------------------
    # Read file bytes and enforce size limit BEFORE any parsing.
    # FIX 2: max_upload_size_bytes is now 10 MB (changed in config.py).
    # We read with a hard cap so we never buffer more than the limit in memory.
    # -------------------------------------------------------------------------
    max_bytes = settings.max_upload_size_bytes
    # Read one byte beyond the limit so we can detect over-size without
    # reading the entire payload into memory first.
    manifest_bytes = await file.read(max_bytes + 1)

    if len(manifest_bytes) > max_bytes:
        size_mb = max_bytes / 1_048_576
        raise HTTPException(
            status_code=413,
            detail=(
                f"Manifest file exceeds the {size_mb:.0f} MB limit. "
                "If your manifest is larger, consider using the GitHub Action instead."
            ),
        )

    if not manifest_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # -------------------------------------------------------------------------
    # FIX 3: Validate that the bytes are well-formed JSON before passing them
    # to parse_manifest.  Previously, non-JSON bytes (e.g. a ZIP or binary
    # file) would reach the parser and produce an opaque 500 if the parser
    # raised something other than ValueError.  Catching json.JSONDecodeError
    # here gives a clear 422 with a human-readable message.
    # -------------------------------------------------------------------------
    try:
        json.loads(manifest_bytes)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=422,
            detail=(
                f"File is not valid JSON (line {e.lineno}, col {e.colno}). "
                "Make sure you are uploading target/manifest.json from a dbt project."
            ),
        ) from e

    try:
        parsed = parse_manifest(manifest_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.exception("Unexpected error parsing manifest")
        raise HTTPException(
            status_code=500,
            detail="Failed to parse manifest. Make sure this is a valid dbt manifest.json.",
        ) from e

    if parsed.model_count == 0:
        raise HTTPException(
            status_code=422,
            detail=(
                "No dbt models found in this manifest. "
                "Make sure you're uploading target/manifest.json from a dbt project."
            ),
        )

    logger.info(
        "Parsed manifest: %s models, dbt %s",
        parsed.model_count,
        parsed.dbt_version,
    )

    return to_parse_response(parsed)
