"""
services/contract_validator.py — Validate contract YAML against our schema.

We validate two things:
1. The YAML is syntactically valid (PyYAML parse)
2. The structure conforms to our contract schema (manual checks)

We return line numbers where possible because the Monaco Editor in the
frontend can surface them as inline error decorations — a much better
experience than "your YAML is wrong somewhere".
"""

import logging
from typing import Any

import yaml

from app.models.contract import ValidationError, ValidateContractResponse

logger = logging.getLogger(__name__)

# Required top-level keys in a contract
_REQUIRED_TOP_LEVEL = {"version", "model", "columns"}

# Known top-level keys (warn on unexpected ones — typos in key names are common)
_KNOWN_TOP_LEVEL = {
    "version",
    "model",
    "description",
    "owner",
    "freshness",
    "row_count",
    "columns",
}

_KNOWN_COLUMN_KEYS = {
    "not_null",
    "unique",
    "accepted_values",
    "min",
    "max",
    "warn_if_null_rate_above",
}

_KNOWN_FRESHNESS_KEYS = {"warn_after_hours", "error_after_hours"}
_KNOWN_ROW_COUNT_KEYS = {"min", "warn_below"}


def _find_line_number(yaml_text: str, key: str) -> int | None:
    """
    Find the line number of a key in the YAML text.
    This is a best-effort search — it won't handle all edge cases but it
    covers the common case of a top-level or column-level key error.
    """
    for i, line in enumerate(yaml_text.splitlines(), start=1):
        if line.strip().startswith(f"{key}:") or line.strip() == key:
            return i
    return None


def validate_contract_yaml(yaml_text: str) -> ValidateContractResponse:
    """
    Validate a contract YAML string.

    Returns a ValidateContractResponse with is_valid, errors, and warnings.
    Errors block export; warnings are advisory.
    """
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []

    if not yaml_text or not yaml_text.strip():
        return ValidateContractResponse(
            is_valid=False,
            errors=[ValidationError(message="Contract is empty.", severity="error")],
        )

    # Step 1: Parse YAML syntax
    try:
        data: Any = yaml.safe_load(yaml_text)
    except yaml.YAMLError as e:
        line = None
        if hasattr(e, "problem_mark") and e.problem_mark:
            line = e.problem_mark.line + 1
        return ValidateContractResponse(
            is_valid=False,
            errors=[
                ValidationError(
                    line=line,
                    message=f"YAML syntax error: {e.problem if hasattr(e, 'problem') else str(e)}",
                    severity="error",
                )
            ],
        )

    if not isinstance(data, dict):
        return ValidateContractResponse(
            is_valid=False,
            errors=[
                ValidationError(
                    message="Contract must be a YAML mapping (dict), not a list or scalar.",
                    severity="error",
                )
            ],
        )

    # Step 2: Required top-level keys
    for key in _REQUIRED_TOP_LEVEL:
        if key not in data:
            line = _find_line_number(yaml_text, key)
            errors.append(
                ValidationError(
                    line=line,
                    message=f"Missing required field: '{key}'",
                    severity="error",
                )
            )

    # Step 3: Warn about unknown top-level keys (usually typos)
    for key in data.keys():
        if key not in _KNOWN_TOP_LEVEL:
            line = _find_line_number(yaml_text, str(key))
            warnings.append(
                ValidationError(
                    line=line,
                    message=f"Unrecognised field '{key}' — did you mean one of: {', '.join(sorted(_KNOWN_TOP_LEVEL))}?",
                    severity="warning",
                )
            )

    # Step 4: Version check
    if "version" in data and data["version"] != 1:
        line = _find_line_number(yaml_text, "version")
        errors.append(
            ValidationError(
                line=line,
                message=f"Unsupported contract version '{data['version']}'. Only version 1 is supported.",
                severity="error",
            )
        )

    # Step 5: Freshness validation
    freshness = data.get("freshness", {})
    if freshness and isinstance(freshness, dict):
        warn_hours = freshness.get("warn_after_hours")
        error_hours = freshness.get("error_after_hours")
        if warn_hours is not None and error_hours is not None:
            if warn_hours >= error_hours:
                line = _find_line_number(yaml_text, "freshness")
                errors.append(
                    ValidationError(
                        line=line,
                        message=f"freshness.warn_after_hours ({warn_hours}) must be less than error_after_hours ({error_hours}).",
                        severity="error",
                    )
                )
        for key in freshness.keys():
            if key not in _KNOWN_FRESHNESS_KEYS:
                warnings.append(
                    ValidationError(
                        message=f"Unknown freshness key '{key}'.",
                        severity="warning",
                    )
                )

    # Step 6: Columns validation
    columns = data.get("columns", {})
    if columns and not isinstance(columns, dict):
        line = _find_line_number(yaml_text, "columns")
        errors.append(
            ValidationError(
                line=line,
                message="'columns' must be a mapping of column names to column contracts.",
                severity="error",
            )
        )
    elif isinstance(columns, dict):
        for col_name, col_data in columns.items():
            if not isinstance(col_data, dict):
                errors.append(
                    ValidationError(
                        message=f"Column '{col_name}' must be a mapping, not a scalar.",
                        severity="error",
                    )
                )
                continue

            # Validate warn_if_null_rate_above is a valid fraction
            null_rate = col_data.get("warn_if_null_rate_above")
            if null_rate is not None and not isinstance(null_rate, bool):
                if not (0.0 <= float(null_rate) <= 1.0):
                    errors.append(
                        ValidationError(
                            message=f"Column '{col_name}': warn_if_null_rate_above must be between 0.0 and 1.0, got {null_rate}.",
                            severity="error",
                        )
                    )

            # min/max sanity check
            col_min = col_data.get("min")
            col_max = col_data.get("max")
            if col_min is not None and col_max is not None:
                if col_min > col_max:
                    errors.append(
                        ValidationError(
                            message=f"Column '{col_name}': min ({col_min}) is greater than max ({col_max}).",
                            severity="error",
                        )
                    )

            # Warn about unknown column-level keys
            for key in col_data.keys():
                if key not in _KNOWN_COLUMN_KEYS:
                    warnings.append(
                        ValidationError(
                            message=f"Column '{col_name}': unrecognised key '{key}'.",
                            severity="warning",
                        )
                    )

    is_valid = len(errors) == 0
    return ValidateContractResponse(is_valid=is_valid, errors=errors, warnings=warnings)
