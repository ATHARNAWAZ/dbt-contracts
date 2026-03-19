"""Tests for the contract YAML validator."""

import pytest
from app.services.contract_validator import validate_contract_yaml

VALID_CONTRACT = """\
version: 1
model: orders
description: "Orders mart."
owner: analytics
freshness:
  warn_after_hours: 24
  error_after_hours: 48
row_count:
  min: 10
  warn_below: 100
columns:
  order_id:
    not_null: true
    unique: true
    accepted_values: []
    min: null
    max: null
    warn_if_null_rate_above: null
  status:
    not_null: false
    unique: false
    accepted_values: [completed, pending, failed]
    min: null
    max: null
    warn_if_null_rate_above: 0.05
"""


def test_valid_contract_passes():
    result = validate_contract_yaml(VALID_CONTRACT)
    assert result.is_valid is True
    assert result.errors == []


def test_empty_contract_fails():
    result = validate_contract_yaml("")
    assert result.is_valid is False
    assert any("empty" in e.message.lower() for e in result.errors)


def test_missing_required_fields():
    result = validate_contract_yaml("version: 1\n")
    assert result.is_valid is False
    # Should report missing 'model' and 'columns'
    messages = " ".join(e.message for e in result.errors)
    assert "model" in messages
    assert "columns" in messages


def test_wrong_version_fails():
    yaml = VALID_CONTRACT.replace("version: 1", "version: 2")
    result = validate_contract_yaml(yaml)
    assert result.is_valid is False
    assert any("version" in e.message.lower() for e in result.errors)


def test_invalid_yaml_syntax():
    result = validate_contract_yaml("version: 1\n  bad indent: [unclosed")
    assert result.is_valid is False
    assert any("syntax" in e.message.lower() for e in result.errors)


def test_freshness_warn_greater_than_error():
    """warn_after_hours must be less than error_after_hours."""
    yaml = VALID_CONTRACT.replace(
        "  warn_after_hours: 24\n  error_after_hours: 48",
        "  warn_after_hours: 48\n  error_after_hours: 24",
    )
    result = validate_contract_yaml(yaml)
    assert result.is_valid is False
    assert any("warn_after_hours" in e.message for e in result.errors)


def test_column_min_greater_than_max():
    yaml = VALID_CONTRACT.replace(
        "    min: null\n    max: null\n    warn_if_null_rate_above: null",
        "    min: 100\n    max: 10\n    warn_if_null_rate_above: null",
        1,
    )
    result = validate_contract_yaml(yaml)
    assert result.is_valid is False
    assert any("min" in e.message and "max" in e.message for e in result.errors)


def test_null_rate_out_of_range():
    yaml = VALID_CONTRACT.replace("warn_if_null_rate_above: 0.05", "warn_if_null_rate_above: 1.5")
    result = validate_contract_yaml(yaml)
    assert result.is_valid is False


def test_unknown_top_level_key_produces_warning():
    yaml = VALID_CONTRACT + "typo_key: some_value\n"
    result = validate_contract_yaml(yaml)
    # Unknown key is a warning, not an error — still valid
    assert result.is_valid is True
    assert any("typo_key" in w.message for w in result.warnings)
