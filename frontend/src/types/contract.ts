// Types for data contracts — mirrors the backend Pydantic models.

export type ContractStatus = 'idle' | 'generating' | 'generated' | 'error' | 'validated'

export interface ValidationError {
  line: number | null
  column: number | null
  message: string
  severity: 'error' | 'warning'
}

export interface ContractState {
  modelName: string
  // Raw YAML string — displayed in Monaco and sent to validate/export
  yaml: string
  status: ContractStatus
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  // ISO timestamp of last generation — for history tab
  generatedAt: string | null
}

export interface GenerateContractRequest {
  manifest_hash: string
  model_name: string
  model_data: Record<string, unknown>
}

export interface ValidateContractRequest {
  contract_yaml: string
  model_name?: string
}

export interface ValidateContractResponse {
  is_valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

export interface ExportContractsResponse {
  contracts_yaml: string
  github_action_yaml: string
  model_count: number
}
