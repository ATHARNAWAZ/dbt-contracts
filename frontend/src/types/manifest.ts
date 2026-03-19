// Types for dbt manifest parsing — mirrors the backend Pydantic models.

export interface ColumnInfo {
  name: string
  description: string
  data_type: string
  meta: Record<string, unknown>
}

export type ModelLayer = 'staging' | 'intermediate' | 'mart' | 'unknown'

export interface ModelNode {
  unique_id: string
  name: string
  schema_name: string
  database: string
  description: string
  resource_type: string
  layer: ModelLayer
  columns: Record<string, ColumnInfo>
  tags: string[]
  config: Record<string, unknown>
  depends_on: Record<string, string[]>
  existing_tests: string[]
}

export interface ManifestParseResponse {
  manifest_hash: string
  dbt_version: string
  project_name: string
  model_count: number
  source_count: number
  models: ModelNode[]
}
