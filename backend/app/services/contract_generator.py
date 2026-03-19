"""
services/contract_generator.py — Programmatic contract generation fallback.

When Claude streaming isn't available (tests, rate limits, offline dev, or no
API key configured), this service generates a reasonable default contract from
column metadata using deterministic heuristics.

It's also used to generate the GitHub Action YAML included in exports.
"""

import logging
from typing import Any

import yaml

from app.models.contract import (
    ColumnContract,
    DataContract,
    FreshnessContract,
    RowCountContract,
)
from app.models.manifest import ModelNode

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Layer-based defaults
#
# These mirror the rules in the Claude system prompt so that the programmatic
# fallback produces contracts that are consistent with AI-generated ones.
# ---------------------------------------------------------------------------

_FRESHNESS_BY_LAYER: dict[str, FreshnessContract] = {
    "staging": FreshnessContract(warn_after_hours=6, error_after_hours=12),
    "intermediate": FreshnessContract(warn_after_hours=12, error_after_hours=24),
    "mart": FreshnessContract(warn_after_hours=24, error_after_hours=48),
    "unknown": FreshnessContract(warn_after_hours=24, error_after_hours=48),
}

_ROW_COUNT_BY_LAYER: dict[str, RowCountContract] = {
    "staging": RowCountContract(min=None, warn_below=None),
    "intermediate": RowCountContract(min=None, warn_below=50),
    "mart": RowCountContract(min=10, warn_below=100),
    "unknown": RowCountContract(min=None, warn_below=None),
}

# owner field mirrors the system prompt spec:
#   sources -> "source", stg_ models -> "staging", marts -> "data-platform"
_OWNER_BY_LAYER: dict[str, str] = {
    "staging": "staging",
    "intermediate": "staging",
    "mart": "data-platform",
    "unknown": "staging",
}

# Known enum columns and their accepted values.
# We intentionally do not enumerate unbounded sets (e.g. currency_code).
_STATUS_ACCEPTED_VALUES: dict[str, list[str]] = {
    "status": ["pending", "completed", "failed", "reversed"],
    "transaction_type": ["purchase", "refund", "chargeback", "transfer"],
    "kyc_status": ["pending", "approved", "rejected", "expired"],
    "risk_tier": ["low", "medium", "high"],
    "segment": ["retail", "sme", "enterprise"],
    "currency_code": [],  # Too many valid values to enumerate; leave empty
    "product_type": ["card", "loan", "savings", "investment"],
    "platform": ["web", "ios", "android"],
    "event_category": ["navigation", "engagement", "conversion"],
    "is_active": [],  # boolean — accepted_values handled via boolean branch
    "is_deleted": [],
}


# ---------------------------------------------------------------------------
# Column-type heuristics
# ---------------------------------------------------------------------------

def _is_primary_key(col_name: str, model_name: str) -> bool:
    """
    Return True if the column is likely the grain-level primary key.

    We match:
      - the bare name "id"
      - "<model_name>_id"  (e.g. model=stg_accounts -> account_id)
      - "<model_name_without_prefix>_id" so stg_orders / fct_orders both map
        to order_id without requiring an exact model name match
      - the explicit hardcoded IDs that commonly appear in fintech models
    """
    if col_name == "id":
        return True

    # Exact match: stg_accounts -> accounts_id or account_id
    if col_name == f"{model_name}_id":
        return True

    # Strip common dbt layer prefixes (stg_, int_, fct_, dim_) and try again.
    # E.g. model "fct_orders" -> base "orders" -> "order_id" and "orders_id".
    for prefix in ("stg_", "int_", "fct_", "dim_", "mart_"):
        if model_name.startswith(prefix):
            base = model_name[len(prefix):]
            if col_name in (f"{base}_id", f"{base.rstrip('s')}_id"):
                return True

    return False


def _is_foreign_key(col_name: str) -> bool:
    """Return True if this looks like a foreign key reference."""
    return col_name.endswith("_id") and col_name != "id"


def _is_timestamp(col_name: str, data_type: str) -> bool:
    """Return True for timestamp/date/time columns."""
    return data_type.lower() in ("timestamp", "timestamptz", "datetime", "date", "time") or (
        col_name.endswith(("_at", "_date", "_time"))
    )


def _is_monetary(col_name: str, data_type: str) -> bool:
    """Return True for columns that likely carry a monetary/numeric amount."""
    return (
        col_name.endswith(("_usd", "_amount", "_fee", "_revenue", "_price", "_cost", "_balance"))
        or data_type.lower() in ("numeric", "decimal", "float", "double precision", "money")
    )


def _is_boolean(col_name: str, data_type: str) -> bool:
    """Return True for boolean columns."""
    return data_type.lower() == "boolean" or col_name.startswith(("is_", "has_", "can_"))


def _is_email(col_name: str) -> bool:
    """Return True for email address columns."""
    return "email" in col_name


def _timestamp_not_null(col_name: str) -> bool:
    """
    Return True if this timestamp column should be not_null.

    Columns recording when something was *created* or *inserted* are always
    populated. Columns recording when something *settled*, *expired*, or was
    *deleted* are often null for in-progress records.
    """
    nullable_keywords = ("settled", "expired", "deleted", "closed", "cancelled", "refunded")
    if any(kw in col_name for kw in nullable_keywords):
        return False
    # created_at, inserted_at, updated_at are usually not-null
    not_null_keywords = ("created", "inserted", "updated", "loaded", "received")
    return any(kw in col_name for kw in not_null_keywords)


def _build_column_contract(
    col_name: str,
    col_info: Any,
    model_name: str,
) -> ColumnContract:
    """
    Infer a ColumnContract from column metadata using engineering heuristics.

    The rules here mirror those in the Claude system prompt so the fallback
    path produces output that is structurally consistent with AI generation.
    """
    # Support both ColumnInfo objects (from the manifest parser) and raw dicts
    # (forwarded by the frontend when calling the fallback endpoint directly).
    data_type = ""
    if hasattr(col_info, "data_type"):
        data_type = col_info.data_type or ""
    elif isinstance(col_info, dict):
        data_type = col_info.get("data_type", "") or ""

    data_type = data_type.strip()

    contract = ColumnContract()

    if _is_primary_key(col_name, model_name):
        contract.not_null = True
        contract.unique = True
        contract.warn_if_null_rate_above = None

    elif _is_foreign_key(col_name):
        # FK columns are often nullable (optional relationships are common).
        # We warn if more than 10 % are null — higher than most other columns
        # because some nullability is expected and legitimate.
        contract.not_null = False
        contract.unique = False
        contract.warn_if_null_rate_above = 0.1

    elif _is_boolean(col_name, data_type):
        contract.not_null = True
        contract.unique = False
        contract.accepted_values = ["true", "false"]
        contract.warn_if_null_rate_above = None

    elif _is_timestamp(col_name, data_type):
        # Parentheses make the compound condition explicit and avoid relying on
        # Python's operator precedence (and binds tighter than or).
        contract.not_null = _timestamp_not_null(col_name)
        contract.warn_if_null_rate_above = 0.05

    elif _is_monetary(col_name, data_type):
        # Monetary amounts should never be negative; no upper bound by default.
        contract.not_null = False
        contract.min = 0.0
        contract.max = None
        contract.warn_if_null_rate_above = 0.05

    elif _is_email(col_name):
        # Email columns are required for registration flows but may be absent
        # on anonymous/guest records; default to not required.
        contract.not_null = False
        contract.warn_if_null_rate_above = 0.05

    # Overlay accepted_values for known enum columns regardless of which branch
    # was taken above (a status column may also end in _id in rare cases).
    if col_name in _STATUS_ACCEPTED_VALUES and _STATUS_ACCEPTED_VALUES[col_name]:
        contract.accepted_values = _STATUS_ACCEPTED_VALUES[col_name]

    return contract


def generate_contract_from_model(model: ModelNode) -> DataContract:
    """
    Generate a DataContract from a ModelNode using heuristic rules.

    This is the fallback path used when Claude is unavailable — either because
    ANTHROPIC_API_KEY is not set or a rate-limit / network error was encountered.

    The output won't be as nuanced as the AI-generated version (Claude can use
    the model description to infer accepted_values, for example) but it will be
    valid YAML, immediately usable, and easy to edit by hand.
    """
    layer = model.layer or "unknown"

    column_contracts: dict[str, ColumnContract] = {}
    for col_name, col_info in model.columns.items():
        column_contracts[col_name] = _build_column_contract(col_name, col_info, model.name)

    # Derive a human-readable description from the model name if none is provided.
    description = model.description
    if not description:
        readable = model.name.replace("_", " ")
        description = f"Data contract for {readable}."

    return DataContract(
        version=1,
        model=model.name,
        description=description,
        owner=_OWNER_BY_LAYER.get(layer, "staging"),
        freshness=_FRESHNESS_BY_LAYER.get(layer, FreshnessContract()),
        row_count=_ROW_COUNT_BY_LAYER.get(layer, RowCountContract()),
        columns=column_contracts,
    )


def contract_to_yaml(contract: DataContract) -> str:
    """
    Serialise a DataContract to the canonical YAML format.

    We build an intermediate dict rather than using Pydantic's .model_dump()
    so we control key order (sort_keys=False preserves insertion order, which
    matches the schema documented in the system prompt).
    """
    data: dict[str, Any] = {
        "version": contract.version,
        "model": contract.model,
        "description": contract.description,
        "owner": contract.owner,
        "freshness": {
            "warn_after_hours": contract.freshness.warn_after_hours,
            "error_after_hours": contract.freshness.error_after_hours,
        },
        "row_count": {
            "min": contract.row_count.min,
            "warn_below": contract.row_count.warn_below,
        },
        "columns": {
            col_name: {
                "not_null": col.not_null,
                "unique": col.unique,
                "accepted_values": col.accepted_values,
                "min": col.min,
                "max": col.max,
                "warn_if_null_rate_above": col.warn_if_null_rate_above,
            }
            for col_name, col in contract.columns.items()
        },
    }

    return yaml.dump(data, default_flow_style=False, sort_keys=False, allow_unicode=True)


# ---------------------------------------------------------------------------
# GitHub Action template
# ---------------------------------------------------------------------------

GITHUB_ACTION_TEMPLATE = """\
# dbt-contracts GitHub Action
# Auto-generated by dbt-contracts.io
# Place this file at .github/workflows/dbt-contracts.yml

name: dbt Contract Validation

on:
  pull_request:
    paths:
      - 'models/**'
      - 'contracts/**'
  push:
    branches:
      - main

jobs:
  validate-contracts:
    name: Validate dbt contracts
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Validate dbt contracts
        uses: dbt-contracts/action@v1
        with:
          contracts-path: contracts/contracts.yml
          manifest-path: target/manifest.json
          # Fail the build if any contract is violated
          fail-on-violation: true
"""


def generate_github_action_yaml() -> str:
    return GITHUB_ACTION_TEMPLATE
