"""
limiter.py — Shared rate limiter instance.

A single Limiter must be used across all routers so that:
1. All request counters share the same in-memory store.
2. RateLimitExceeded exceptions are raised from the one instance whose
   handler is registered on the FastAPI app in main.py.

Importing this module from both main.py and the routers avoids the circular
import that would result from routers importing directly from main.py.

Usage in a router:
    from app.limiter import limiter

    @router.post("/some-endpoint")
    @limiter.limit("5/hour")
    async def handler(request: Request, ...):
        ...

The key_func is set to extract the real client IP from the X-Forwarded-For
header, which is the correct value behind Railway's load balancer.  The
fallback is request.client.host for local development where no proxy is
present.
"""

from fastapi import Request
from slowapi import Limiter


def _get_client_ip(request: Request) -> str:
    """
    Resolve the client's IP address, preferring X-Forwarded-For.

    Railway (and most reverse proxies) set X-Forwarded-For to the real
    originating IP.  Without this, request.client.host is the load-balancer
    address and all users share a single rate-limit counter.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # The header may contain "client, proxy1, proxy2"; take the leftmost
        # entry which is the original client (closest to real-world IP).
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# Single shared Limiter instance — import this in both main.py and routers.
limiter = Limiter(key_func=_get_client_ip, default_limits=[])
