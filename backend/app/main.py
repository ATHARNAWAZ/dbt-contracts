"""
main.py — FastAPI application entry point.

Responsibilities:
- Create the FastAPI app with metadata for OpenAPI docs
- Configure CORS (browser clients need this)
- Mount rate limiter
- Register all routers
- Expose /health for Railway health checks
- Apply security headers to every response
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import get_settings
from app.limiter import limiter  # shared instance — import before routers so they can use it
from app.routers import contracts, manifest, waitlist

logger = logging.getLogger(__name__)

settings = get_settings()
# limiter is imported from app.limiter — shared across all routers


# ---------------------------------------------------------------------------
# Security headers middleware
# FIX: No security headers were present at all (requirement 6).
# ---------------------------------------------------------------------------
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add OWASP-recommended security headers to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Prevent MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        # Deny framing entirely — this app has no legitimate iframe use-case
        response.headers["X-Frame-Options"] = "DENY"
        # Legacy XSS filter for older browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # HSTS: 1 year, include subdomains.  Only meaningful over HTTPS but
        # harmless to set unconditionally.
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        # Restrictive CSP — this is a pure API, so no scripts/styles are
        # served; default-src 'none' is the tightest possible policy.
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        # Don't send the full URL as Referer when navigating away
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Disable all browser features the API doesn't need
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )
        # FIX: Remove the Server header to avoid disclosing the ASGI server
        # name and version (uvicorn/starlette expose this by default).
        # MutableHeaders doesn't support .pop() — use __delitem__ with guard
        if "server" in response.headers:
            del response.headers["server"]

        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown hooks."""
    logger.info(
        "dbt-contracts API starting",
        extra={
            "environment": settings.environment,
            "claude_model": settings.claude_model,
        },
    )
    yield
    logger.info("dbt-contracts API shutting down")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="dbt-contracts API",
    description=(
        "Generate and validate data contracts for dbt models. "
        "No installation required."
    ),
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Attach the rate limiter so routers can use @limiter.limit decorators.
# All routers must import `limiter` from app.limiter rather than instantiating
# their own — separate instances have isolated counter stores and their
# RateLimitExceeded exceptions bypass this handler.
app.state.limiter = limiter


# ---------------------------------------------------------------------------
# Custom 429 handler — returns JSON with a human-readable message.
# slowapi's built-in _rate_limit_exceeded_handler returns plain text; we
# register our own handler to provide a consistent JSON error response.
# ---------------------------------------------------------------------------
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "Generating a lot of contracts! "
                f"Free tier limit is {settings.rate_limit_per_hour}/hour. "
                "Sign up to increase your limit."
            )
        },
        headers={"Retry-After": "3600"},
    )


# ---------------------------------------------------------------------------
# Middleware — order matters: middlewares wrap the handler in reverse
# registration order (last registered = outermost wrapper).
# Security headers go on first so they appear on every response including
# error responses generated by later middleware.
# ---------------------------------------------------------------------------
app.add_middleware(SecurityHeadersMiddleware)

# ---------------------------------------------------------------------------
# CORS
# Frontend (Vite dev server or production origin) needs pre-flight support.
# Credentials=True is not needed because we don't use cookies.
# FIX: cors_origins_list now enforces production-safe origins (see config.py).
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


# ---------------------------------------------------------------------------
# Global exception handler — return JSON instead of HTML for 500s
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Something broke. Ironically, we don't have a contract for this.",
            "type": "internal_server_error",
        },
    )


# ---------------------------------------------------------------------------
# Health check — Railway polls this before routing traffic.
# FIX: Removed environment disclosure from the public response body.  The
# environment name is internal operational detail; exposing it in a public
# endpoint is unnecessary information disclosure.
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
async def health_check():
    return {
        "status": "ok",
        "version": "1.0.0",
    }


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------
app.include_router(manifest.router, prefix="/api/manifest", tags=["manifest"])
app.include_router(contracts.router, prefix="/api/contracts", tags=["contracts"])
app.include_router(waitlist.router, prefix="/api", tags=["waitlist"])
