"""
routers/waitlist.py — Waitlist and public stats endpoints.

POST /api/waitlist — Capture an email address
GET  /api/stats   — Return public usage statistics (landing page counter)
"""

import logging
import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from supabase import Client, create_client

from app.config import get_settings
from app.limiter import limiter  # shared app-level limiter

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()

# ---------------------------------------------------------------------------
# Supabase client — created lazily because settings may not be available
# at import time during testing.
# ---------------------------------------------------------------------------
_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _supabase_client


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

_EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


class WaitlistRequest(BaseModel):
    model_config = ConfigDict()

    email: str
    source: str = Field(default="landing", max_length=64)
    referrer: str | None = Field(default=None, max_length=2048)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_REGEX.match(v):
            raise ValueError("Invalid email address.")
        if len(v) > 254:
            raise ValueError("Email address is too long.")
        return v


class WaitlistResponse(BaseModel):
    model_config = ConfigDict()

    success: bool
    message: str


class StatsResponse(BaseModel):
    model_config = ConfigDict()

    total_manifests: int
    total_contracts: int
    total_waitlist: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/waitlist", response_model=WaitlistResponse)
@limiter.limit("5/hour")
async def join_waitlist(request: Request, body: WaitlistRequest):
    """
    Add an email to the waitlist.

    Gracefully handles duplicate emails — we don't want to tell the user
    they're already on the list (that leaks whether an email exists).
    """
    try:
        db = get_supabase()
        db.table("waitlist").insert(
            {
                "email": body.email,
                "source": body.source,
                "referrer": body.referrer,
            }
        ).execute()

        logger.info("New waitlist signup: %s via %s", body.email[:3] + "***", body.source)

        return WaitlistResponse(
            success=True,
            message="You're on the list. We'll be in touch.",
        )

    except Exception as e:
        # Supabase throws on unique constraint violation — treat as success
        # to avoid email enumeration.
        error_str = str(e).lower()
        if "unique" in error_str or "duplicate" in error_str:
            return WaitlistResponse(
                success=True,
                message="You're on the list. We'll be in touch.",
            )

        logger.exception("Waitlist insert failed for email: %s", body.email[:3] + "***")
        raise HTTPException(
            status_code=500,
            detail="Failed to join waitlist. Please try again.",
        ) from e


@router.get("/stats", response_model=StatsResponse)
async def get_stats(request: Request):
    """
    Return public usage statistics for the landing page.

    Stats are maintained by Postgres triggers so this is a cheap single-row
    SELECT rather than an expensive COUNT(*) scan.
    """
    try:
        db = get_supabase()
        result = db.table("stats").select("*").eq("id", 1).single().execute()

        data = result.data or {}
        return StatsResponse(
            total_manifests=data.get("total_manifests", 0),
            total_contracts=data.get("total_contracts", 0),
            total_waitlist=data.get("total_waitlist", 0),
        )

    except Exception as e:
        logger.exception("Failed to fetch stats")
        # Return zeros rather than a 500 — the landing page should render
        # even if the stats query fails.
        return StatsResponse(total_manifests=0, total_contracts=0, total_waitlist=0)
