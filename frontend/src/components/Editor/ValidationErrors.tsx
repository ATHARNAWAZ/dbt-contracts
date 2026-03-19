import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ValidationError } from '../../types/contract'

interface ValidationErrorsProps {
  errors: ValidationError[]
  warnings: ValidationError[]
  isValid: boolean
}

export function ValidationErrors({ errors, warnings, isValid }: ValidationErrorsProps) {
  if (errors.length === 0 && warnings.length === 0) {
    if (isValid) {
      return (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-success bg-success/5 border-t border-border">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          Contract is valid
        </div>
      )
    }
    return null
  }

  return (
    <div className="border-t border-border max-h-40 overflow-y-auto">
      {errors.map((err, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-4 py-2 text-xs text-error border-b border-border/50 last:border-0"
        >
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {err.line && <span className="text-text-muted mr-1">L{err.line}</span>}
            {err.message}
          </span>
        </div>
      ))}
      {warnings.map((warn, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-4 py-2 text-xs text-warning border-b border-border/50 last:border-0"
        >
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            {warn.line && <span className="text-text-muted mr-1">L{warn.line}</span>}
            {warn.message}
          </span>
        </div>
      ))}
    </div>
  )
}
