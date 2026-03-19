import type { ReactNode } from 'react'
import { Database, GitBranch, BarChart3, HelpCircle, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ModelNode } from '../../types/manifest'
import { useContractStore } from '../../stores/contractStore'

interface ModelItemProps {
  model: ModelNode
  isSelected: boolean
  onClick: () => void
}

// Layer icons — all decorative; the model name and list context carry meaning.
const layerIcons: Record<string, ReactNode> = {
  staging: <Database className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" aria-hidden="true" />,
  intermediate: <GitBranch className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" aria-hidden="true" />,
  mart: <BarChart3 className="h-3.5 w-3.5 text-accent flex-shrink-0" aria-hidden="true" />,
  unknown: <HelpCircle className="h-3.5 w-3.5 text-text-muted flex-shrink-0" aria-hidden="true" />,
}

// Contract status labels for screen readers — the visual icons alone convey
// nothing to non-sighted users (WCAG 1.1.1 Non-text Content).
const statusLabels: Record<string, string> = {
  generating: 'generating contract',
  validated: 'contract validated',
  error: 'contract has errors',
  generated: 'contract generated, not yet validated',
}

function ContractStatusIcon({ modelName }: { modelName: string }) {
  const contracts = useContractStore((s) => s.contracts)
  const contract = contracts[modelName]

  if (!contract) return null

  const label = statusLabels[contract.status] ?? ''

  switch (contract.status) {
    case 'generating':
      return (
        <span aria-label={label}>
          <Loader2 className="h-3 w-3 text-accent animate-spin flex-shrink-0" aria-hidden="true" />
        </span>
      )
    case 'validated':
      return (
        <span aria-label={label}>
          <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" aria-hidden="true" />
        </span>
      )
    case 'error':
      return (
        <span aria-label={label}>
          <AlertCircle className="h-3 w-3 text-error flex-shrink-0" aria-hidden="true" />
        </span>
      )
    case 'generated':
      return (
        <span aria-label={label}>
          <div className="h-1.5 w-1.5 rounded-full bg-warning flex-shrink-0" aria-hidden="true" />
        </span>
      )
    default:
      return null
  }
}

export function ModelItem({ model, isSelected, onClick }: ModelItemProps) {
  const icon = layerIcons[model.layer] ?? layerIcons['unknown']

  return (
    <button
      onClick={onClick}
      // aria-pressed communicates selection state to screen readers
      // (WCAG 4.1.2 Name, Role, Value)
      aria-pressed={isSelected}
      aria-label={`${model.name}${isSelected ? ', currently selected' : ''}`}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded text-left',
        'transition-colors duration-100 text-xs',
        // Ensure focus ring is visible for keyboard users (WCAG 2.4.7)
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
        isSelected
          ? 'bg-accent/10 text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface'
      )}
    >
      {icon}
      <span className="flex-1 truncate font-mono" aria-hidden="true">{model.name}</span>
      <ContractStatusIcon modelName={model.name} />
    </button>
  )
}
