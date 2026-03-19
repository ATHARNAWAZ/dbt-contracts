"""
models/manifest.py — Pydantic models for dbt manifest parsing.

These models represent the *subset* of the dbt manifest schema that we need.
The full manifest can be hundreds of MB; we only extract what's relevant for
contract generation.

All models use Pydantic v2 ConfigDict — no inner class Config.

Note on ModelNode.schema_name:
  The dbt manifest uses "schema" as the key, but "schema" is a reserved
  attribute name in older Pydantic versions. We store it internally as
  `schema_name` and accept the dbt key "schema" via a Field alias.
  `populate_by_name=True` allows the manifest parser to set it by either name.
  When the API serialises this model (model.model_dump()) the Python name
  `schema_name` is used. The frontend and claude_service receive `schema_name`
  as the dict key.  The `to_claude_dict()` helper remaps it to "schema" for
  the prompt builder so the column context reads naturally.
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ColumnInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    name: str
    description: str = ""
    data_type: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


class ModelNode(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    unique_id: str
    name: str
    # dbt manifest uses "schema" as the key; alias it here to avoid shadowing
    # the Pydantic base-class .schema() classmethod.
    schema_name: str = Field("", alias="schema")
    database: str = ""
    description: str = ""
    resource_type: str = "model"
    # Layer inferred from fqn path or tags: staging, intermediate, mart
    layer: str = ""
    columns: dict[str, ColumnInfo] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    config: dict[str, Any] = Field(default_factory=dict)
    depends_on: dict[str, list[str]] = Field(default_factory=dict)
    # dbt tests already defined on this model (used to avoid duplicate contracts)
    existing_tests: list[str] = Field(default_factory=list)

    def to_claude_dict(self) -> dict[str, Any]:
        """
        Return a plain dict suitable for passing to claude_service.

        Remaps `schema_name` back to "schema" so the prompt builder receives
        the field name that reads naturally in the context of a dbt model.
        """
        return {
            "name": self.name,
            "schema": self.schema_name,
            "database": self.database,
            "description": self.description,
            "resource_type": self.resource_type,
            "layer": self.layer,
            "columns": {
                col_name: {
                    "name": col.name,
                    "description": col.description,
                    "data_type": col.data_type,
                    "meta": col.meta,
                }
                for col_name, col in self.columns.items()
            },
            "tags": self.tags,
            "config": self.config,
            "depends_on": self.depends_on,
            "existing_tests": self.existing_tests,
        }


class ParsedManifest(BaseModel):
    """Structured extraction of a dbt manifest ready for contract generation."""
    model_config = ConfigDict(protected_namespaces=())

    dbt_version: str = ""
    project_name: str = ""
    models: list[ModelNode] = Field(default_factory=list)
    source_count: int = 0
    # Metadata for the session record
    manifest_hash: str = ""
    model_count: int = 0


class ManifestParseResponse(BaseModel):
    """Response payload for POST /api/manifest/parse."""
    model_config = ConfigDict(protected_namespaces=())

    manifest_hash: str
    dbt_version: str
    project_name: str
    model_count: int
    source_count: int
    models: list[ModelNode]
