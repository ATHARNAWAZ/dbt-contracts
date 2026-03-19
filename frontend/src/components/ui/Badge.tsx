import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type BadgeVariant = 'staging' | 'intermediate' | 'mart' | 'success' | 'warning' | 'error' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  staging: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  intermediate: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  mart: 'bg-accent/10 text-accent border-accent/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-error/10 text-error border-error/20',
  default: 'bg-surface text-text-secondary border-border',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
