"""
config.py — Application configuration via Pydantic Settings.

All settings are read from environment variables (or .env in development).
Pydantic validates types and raises at startup if required vars are missing,
which is far better than discovering a missing API key at request time.
"""

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Look for .env in the backend dir AND the project root.
        # Railway injects env vars directly, so missing .env is fine.
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Anthropic ---
    anthropic_api_key: str

    # --- Supabase ---
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # --- Application ---
    environment: Literal["development", "production", "staging"] = "development"

    # Primary allowed frontend origin — used to build cors_origins_list when
    # CORS_ORIGINS is not explicitly set.
    # FIX: Added FRONTEND_URL as a first-class setting (requirement 4).
    frontend_url: str = "http://localhost:5173"

    # Comma-separated list of allowed CORS origins.  When this is set
    # explicitly it takes precedence; otherwise we derive safe defaults from
    # frontend_url and the current environment.
    # FIX: Default now includes both dev ports (requirement 4).
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- Rate Limiting ---
    rate_limit_per_hour: int = 10

    # --- File Uploads ---
    # FIX: Reduced from 50 MB to 10 MB to match the stated security requirement.
    max_upload_size_bytes: int = 10_485_760  # 10 MB

    # Maximum size of a contract YAML body accepted by /validate and /export.
    # FIX: Added a hard cap so oversized payloads cannot reach the YAML parser.
    max_contract_yaml_bytes: int = 102_400  # 100 KB

    # --- Telemetry ---
    enable_telemetry: bool = True

    # --- Claude model ---
    # Pinned to a specific version so a model update doesn't silently change
    # contract generation behaviour in production.
    claude_model: str = "claude-sonnet-4-20250514"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:
        # Accept comma-separated string from env; we expose as a property below
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        """
        Return the validated list of CORS origins.

        FIX: In production we enforce that no localhost origin is allowed,
        preventing a misconfigured CORS_ORIGINS env var from accidentally
        permitting dev origins in prod (requirement 4).
        """
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

        if self.is_production:
            safe = [o for o in origins if "localhost" not in o and "127.0.0.1" not in o]
            if not safe:
                # Fallback to the explicit FRONTEND_URL so production never
                # ends up with an empty allow-list (which some middlewares
                # interpret as "allow all").
                return [self.frontend_url]
            return safe

        return origins

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    """
    Return a cached Settings instance.

    Using lru_cache means we read from the environment exactly once per
    process lifetime, which is both efficient and prevents subtle bugs
    where settings could change mid-request.
    """
    return Settings()
