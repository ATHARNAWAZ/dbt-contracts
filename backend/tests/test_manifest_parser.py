"""
Tests for the manifest parser service.

We test the parser in isolation — no network, no Supabase, no Claude.
The sample manifest from sample_data/ provides a realistic test fixture.
"""

import json
from pathlib import Path

import pytest

from app.services.manifest_parser import parse_manifest, to_parse_response

SAMPLE_MANIFEST_PATH = Path(__file__).parent.parent.parent / "sample_data" / "sample_manifest.json"


@pytest.fixture
def sample_manifest_bytes() -> bytes:
    return SAMPLE_MANIFEST_PATH.read_bytes()


def test_parse_sample_manifest(sample_manifest_bytes: bytes):
    """The sample manifest should parse cleanly with the expected model count."""
    parsed = parse_manifest(sample_manifest_bytes)

    assert parsed.model_count == 11
    assert parsed.dbt_version == "1.7.4"
    assert parsed.project_name == "fintech_dbt"
    assert parsed.source_count == 4
    assert len(parsed.manifest_hash) == 64  # SHA-256 hex


def test_layer_inference(sample_manifest_bytes: bytes):
    """Models should be correctly categorised into staging/intermediate/mart layers."""
    parsed = parse_manifest(sample_manifest_bytes)

    model_layers = {m.name: m.layer for m in parsed.models}

    assert model_layers["stg_transactions"] == "staging"
    assert model_layers["stg_customers"] == "staging"
    assert model_layers["int_customer_orders"] == "intermediate"
    assert model_layers["int_daily_revenue"] == "intermediate"
    assert model_layers["orders"] == "mart"
    assert model_layers["customers"] == "mart"
    assert model_layers["revenue"] == "mart"


def test_column_parsing(sample_manifest_bytes: bytes):
    """Columns should be parsed with name, description, and data_type."""
    parsed = parse_manifest(sample_manifest_bytes)

    transactions = next(m for m in parsed.models if m.name == "stg_transactions")
    assert "transaction_id" in transactions.columns
    assert transactions.columns["transaction_id"].data_type == "varchar"
    assert "amount_usd" in transactions.columns


def test_models_sorted_by_layer(sample_manifest_bytes: bytes):
    """Models should be returned staging → intermediate → mart."""
    parsed = parse_manifest(sample_manifest_bytes)
    layers = [m.layer for m in parsed.models]

    # After the last staging model, there should be no more staging models
    last_staging = max((i for i, l in enumerate(layers) if l == "staging"), default=-1)
    first_intermediate = min((i for i, l in enumerate(layers) if l == "intermediate"), default=999)
    assert last_staging < first_intermediate


def test_invalid_json_raises():
    with pytest.raises(ValueError, match="Invalid JSON"):
        parse_manifest(b"not json at all {{{")


def test_not_a_manifest_raises():
    """JSON without nodes/sources keys should be rejected."""
    with pytest.raises(ValueError, match="doesn't look like"):
        parse_manifest(json.dumps({"something": "else"}).encode())


def test_to_parse_response(sample_manifest_bytes: bytes):
    """to_parse_response should produce a valid ManifestParseResponse."""
    parsed = parse_manifest(sample_manifest_bytes)
    response = to_parse_response(parsed)

    assert response.model_count == parsed.model_count
    assert response.manifest_hash == parsed.manifest_hash
    assert len(response.models) == parsed.model_count
