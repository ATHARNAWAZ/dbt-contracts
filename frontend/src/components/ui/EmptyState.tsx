import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-12 gap-4',
        className
      )}
    >
      {icon && (
        <div className="text-text-muted">{icon}</div>
      )}
      <div className="space-y-1">
        <p className="text-text-secondary font-medium text-sm">{title}</p>
        {description && (
          <p className="text-text-muted text-xs max-w-xs">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
