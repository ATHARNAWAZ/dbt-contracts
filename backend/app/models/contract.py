"""
models/contract.py — Pydantic models for data contracts.

The canonical contract format is YAML (stored as text in the DB and exported
to files). These Pydantic models are used for API request/response validation
and for programmatic contract creation in contract_generator.py.

All models use Pydantic v2 ConfigDict — no inner class Config.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Domain models (represent a contract's logical structure)
# ---------------------------------------------------------------------------

class FreshnessContract(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    warn_after_hours: int = 24
    error_after_hours: int = 48


class RowCountContract(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    min: int | None = None
    warn_below: int | None = None


class ColumnContract(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    not_null: bool = False
    unique: bool = False
    accepted_values: list[str] = Field(default_factory=list)
    min: float | None = None
    max: float | None = None
    # Warn if more than this fraction of values are null (0.0–1.0)
    warn_if_null_rate_above: float | None = 0.05


class DataContract(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    version: int = 1
    model: str
    description: str = ""
    owner: str = ""
    freshness: FreshnessContract = Field(default_factory=FreshnessContract)
    row_count: RowCountContract = Field(default_factory=RowCountContract)
    columns: dict[str, ColumnContract] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# API request / response models
# ---------------------------------------------------------------------------

# FIX: 100 KB hard cap on YAML fields that reach the parser.
# Without this limit, a caller can POST several megabytes of content to
# /validate or /export and force the server to parse it (CPU + memory spike).
_MAX_YAML_BYTES = 102_400  # 100 KB

# FIX: Reasonable upper bound on free-form string identifiers to prevent log
# injection and oversized payloads in model_name / manifest_hash / session_id.
_MAX_IDENTIFIER_LENGTH = 255


class GenerateContractRequest(BaseModel):
    """
    Request body for POST /api/contracts/generate.

    Supports two shapes:

    Shape 1 — full model_data from a manifest parse response:
        {
            "model_name": "stg_orders",
            "model_data": { ...full ModelNode dict... }
        }

    Shape 2 — lightweight payload for direct use:
        {
            "model_name": "stg_orders",
            "columns": { "order_id": {"data_type": "varchar", "description": "..."} },
            "session_id": "abc123",
            "layer": "staging",
            "description": "Staged orders from the source system",
            "tags": ["staging"]
        }

    Both manifest_hash and session_id are optional — they are recorded for
    analytics but are not required for contract generation.
    """
    model_config = ConfigDict(protected_namespaces=())

    # FIX: Added max_length constraints on identifier fields to prevent log
    # injection via arbitrarily long strings and to enforce sane data sizes.
    model_name: str = Field(..., min_length=1, max_length=_MAX_IDENTIFIER_LENGTH)
    session_id: str | None = Field(default=None, max_length=_MAX_IDENTIFIER_LENGTH)
    manifest_hash: str | None = Field(default=None, max_length=_MAX_IDENTIFIER_LENGTH)

    # --- Shape 1: full model_data dict from manifest parse ---
    model_data: dict[str, Any] | None = None

    # --- Shape 2: lightweight direct payload ---
    columns: dict[str, Any] | None = None
    # FIX: Added max_length on layer, description, and individual tag strings.
    layer: str | None = Field(default=None, max_length=64)
    description: str | None = Field(default=None, max_length=2048)
    tags: list[str] | None = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        # FIX: Enforce a reasonable tag count and per-tag length to prevent
        # oversized payloads that end up stored in logs.
        if len(v) > 50:
            raise ValueError("Too many tags — maximum 50.")
        for tag in v:
            if len(tag) > 64:
                raise ValueError(f"Tag '{tag[:20]}...' exceeds the 64-character limit.")
        return v


class ValidateContractRequest(BaseModel):
    """Request body for POST /api/contracts/validate."""
    model_config = ConfigDict(protected_namespaces=())

    # FIX: Added max_length to enforce the 100 KB contract YAML size limit
    # (requirement 5).  Without this, large YAML blobs reach ruamel/pyyaml and
    # can cause CPU spikes.  Pydantic validates this before the handler runs.
    contract_yaml: str = Field(..., min_length=1, max_length=_MAX_YAML_BYTES)
    model_name: str | None = Field(default=None, max_length=_MAX_IDENTIFIER_LENGTH)


class ValidationError(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    line: int | None = None
    column: int | None = None
    message: str
    severity: str = "error"  # error | warning


class ValidateContractResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    is_valid: bool
    errors: list[ValidationError] = Field(default_factory=list)
    warnings: list[ValidationError] = Field(default_factory=list)


class ExportContractsRequest(BaseModel):
    """Request body for POST /api/contracts/export."""
    model_config = ConfigDict(protected_namespaces=())

    # FIX: Added max_length to enforce the 100 KB YAML size limit on export
    # payloads (requirement 5).  The GET-with-query-param pattern this replaced
    # also had this problem but it was bounded only by URL length limits.
    contracts_yaml: str = Field(..., min_length=1, max_length=_MAX_YAML_BYTES)
    model_count: int = Field(default=1, ge=1, le=10_000)


class ExportContractsResponse(BaseModel):
    """Response for POST /api/contracts/export."""
    model_config = ConfigDict(protected_namespaces=())

    contracts_yaml: str
    github_action_yaml: str
    model_count: int
