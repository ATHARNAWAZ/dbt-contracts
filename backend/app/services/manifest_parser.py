"""
services/manifest_parser.py — Parse a dbt manifest.json into our domain model.

dbt manifests are large JSON blobs with a versioned schema. We defensively
parse only what we need and infer missing metadata (like model layer) from
naming conventions and fqn paths — exactly what a senior data engineer would
do when reading an unfamiliar project.
"""

import hashlib
import json
import logging
from typing import Any

from app.models.manifest import ColumnInfo, ManifestParseResponse, ModelNode, ParsedManifest

logger = logging.getLogger(__name__)


def _infer_layer(node: dict[str, Any]) -> str:
    """
    Infer the dbt layer (staging, intermediate, mart) from the model's
    fully-qualified name, tags, or schema name.

    Convention-over-configuration: most dbt projects follow the stg_ / int_ /
    mart naming convention even if they don't tag their models explicitly.
    """
    name: str = node.get("name", "").lower()
    tags: list[str] = [t.lower() for t in node.get("tags", [])]
    fqn: list[str] = node.get("fqn", [])
    schema: str = node.get("schema", "").lower()

    # Explicit tags take priority over name conventions
    for tag in tags:
        if tag in ("staging", "stg"):
            return "staging"
        if tag in ("intermediate", "int"):
            return "intermediate"
        if tag in ("mart", "core", "reporting"):
            return "mart"

    # fqn path segment is the most reliable signal
    for segment in fqn:
        segment_lower = segment.lower()
        if segment_lower in ("staging",):
            return "staging"
        if segment_lower in ("intermediate",):
            return "intermediate"
        if segment_lower in ("marts", "mart", "core", "reporting"):
            return "mart"

    # Name prefix fallback — widely adopted convention
    if name.startswith("stg_"):
        return "staging"
    if name.startswith("int_"):
        return "intermediate"
    if schema in ("marts", "mart", "reporting", "core"):
        return "mart"

    return "unknown"


def _infer_existing_tests(node: dict[str, Any]) -> list[str]:
    """
    Extract existing dbt test names from a node's depends_on or tests list.
    The manifest schema varies by dbt version, so we try multiple locations.
    """
    tests: list[str] = []

    # dbt v1.5+ stores test references directly in the node
    if "tests" in node and isinstance(node["tests"], list):
        tests.extend(str(t) for t in node["tests"])

    return tests


def _parse_columns(raw_columns: dict[str, Any]) -> dict[str, ColumnInfo]:
    """Parse the columns dict from a manifest node."""
    columns = {}
    for col_name, col_data in raw_columns.items():
        if not isinstance(col_data, dict):
            continue
        columns[col_name] = ColumnInfo(
            name=col_data.get("name", col_name),
            description=col_data.get("description", ""),
            data_type=col_data.get("data_type", ""),
            meta=col_data.get("meta", {}),
        )
    return columns


def parse_manifest(manifest_bytes: bytes) -> ParsedManifest:
    """
    Parse raw manifest.json bytes into a ParsedManifest.

    Raises ValueError if the JSON is invalid or doesn't look like a manifest.
    """
    try:
        raw = json.loads(manifest_bytes)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}") from e

    if "nodes" not in raw and "sources" not in raw:
        raise ValueError(
            "This doesn't look like a dbt manifest.json. "
            "Expected 'nodes' and 'sources' keys."
        )

    metadata = raw.get("metadata", {})
    dbt_version = metadata.get("dbt_version", "unknown")

    # Derive the project name from the first node's package_name — it's the
    # most reliable cross-version way to find it.
    project_name = ""
    nodes: dict[str, Any] = raw.get("nodes", {})

    models: list[ModelNode] = []
    for unique_id, node in nodes.items():
        # Only process model nodes — skip tests, seeds, snapshots
        if node.get("resource_type") != "model":
            continue

        if not project_name:
            project_name = node.get("package_name", "")

        layer = _infer_layer(node)
        columns = _parse_columns(node.get("columns", {}))
        existing_tests = _infer_existing_tests(node)

        model = ModelNode(
            unique_id=unique_id,
            name=node.get("name", ""),
            schema=node.get("schema", ""),
            database=node.get("database", ""),
            description=node.get("description", ""),
            resource_type=node.get("resource_type", "model"),
            layer=layer,
            columns=columns,
            tags=node.get("tags", []),
            config=node.get("config", {}),
            depends_on=node.get("depends_on", {}),
            existing_tests=existing_tests,
        )
        models.append(model)

    # Sort by layer then name for a predictable sidebar order
    layer_order = {"staging": 0, "intermediate": 1, "mart": 2, "unknown": 3}
    models.sort(key=lambda m: (layer_order.get(m.layer, 99), m.name))

    source_count = len(raw.get("sources", {}))
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()

    return ParsedManifest(
        dbt_version=dbt_version,
        project_name=project_name,
        models=models,
        source_count=source_count,
        manifest_hash=manifest_hash,
        model_count=len(models),
    )


def to_parse_response(parsed: ParsedManifest) -> ManifestParseResponse:
    return ManifestParseResponse(
        manifest_hash=parsed.manifest_hash,
        dbt_version=parsed.dbt_version,
        project_name=parsed.project_name,
        model_count=parsed.model_count,
        source_count=parsed.source_count,
        models=parsed.models,
    )
