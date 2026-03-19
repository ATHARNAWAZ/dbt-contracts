/**
 * ContractPreview.tsx — Visual (non-editable) preview of a contract.
 *
 * Renders the parsed contract fields in a readable card layout so
 * non-technical stakeholders can review without reading raw YAML.
 */

import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { useContractStore } from '../../stores/contractStore'
import type { ModelNode } from '../../types/manifest'

interface ContractPreviewProps {
  model: ModelNode
}

function parseYamlLightly(yaml: string): Record<string, unknown> {
  // We don't pull in a full YAML parser for the preview — instead we parse
  // just enough of the top level to show a useful summary.
  // The editor is the source of truth; this is purely visual.
  try {
    const lines = yaml.split('\n')
    const result: Record<string, unknown> = {}

    for (const line of lines) {
      if (line.startsWith('  ')) continue // skip nested lines
      const match = line.match(/^(\w+):\s*(.*)$/)
      if (match) {
        const [, key, value] = match
        if (key && value !== undefined) {
          result[key] = value.replace(/^["']|["']$/g, '')
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

export function ContractPreview({ model }: ContractPreviewProps) {
  const contracts = useContractStore((s) => s.contracts)
  const contract = contracts[model.name]

  if (!contract?.yaml) {
    return (
      <EmptyState
        title="No contract generated yet."
        description="Click Generate to create a contract for this model."
        className="h-full"
      />
    )
  }

  const parsed = parseYamlLightly(contract.yaml)
  const columnCount = Object.keys(model.columns).length

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-mono text-base text-text-primary font-semibold">
            {String(parsed['model'] ?? model.name)}
          </h2>
          <p className="text-text-secondary text-sm mt-1 max-w-prose">
            {String(parsed['description'] ?? model.description ?? 'No description.')}
          </p>
        </div>
        <Badge variant={model.layer as 'staging' | 'intermediate' | 'mart' | 'default'}>
          {model.layer}
        </Badge>
      </div>

      {/* Meta grid — use <dl> for label/value pairs (WCAG 1.3.1) */}
      <dl className="grid grid-cols-2 gap-3">
        <div className="card p-3 space-y-1">
          <dt className="text-text-secondary text-xs uppercase tracking-wide">Owner</dt>
          <dd className="text-text-primary text-sm font-medium">
            {String(parsed['owner'] ?? 'Not set')}
          </dd>
        </div>
        <div className="card p-3 space-y-1">
          <dt className="text-text-secondary text-xs uppercase tracking-wide">Columns</dt>
          <dd className="text-text-primary text-sm font-medium">{columnCount}</dd>
        </div>
      </dl>

      {/* Validation status — role="status" announces changes without requiring focus */}
      {contract.status === 'validated' && (
        <div role="status" aria-live="polite" className="card p-3 flex items-center gap-2">
          {contract.isValid ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" aria-hidden="true" />
              <span className="text-success text-sm">Contract is valid</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-error flex-shrink-0" aria-hidden="true" />
              <span className="text-error text-sm">
                {contract.errors.length} error{contract.errors.length !== 1 ? 's' : ''} found
              </span>
            </>
          )}
        </div>
      )}

      {/* Errors — use <h3> not <p> for section heading so it's navigable */}
      {contract.errors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Errors</h3>
          <ul role="list" className="space-y-1">
            {contract.errors.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-error">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>{e.message}{e.line ? ` (line ${e.line})` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Column list */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Columns</h3>
        <ul role="list" className="space-y-1">
          {Object.entries(model.columns).map(([colName, col]) => (
            <li
              key={colName}
              className="flex items-center gap-2 py-1.5 px-3 rounded bg-surface text-xs"
            >
              <span className="font-mono text-text-primary flex-1">{colName}</span>
              {col.data_type && (
                <span className="text-text-secondary">{col.data_type}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
