import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover active:bg-[#5B21B6] shadow-sm shadow-accent/20',
  secondary:
    'bg-surface text-text-primary border border-border hover:border-border-hover hover:bg-[#1A1A1A]',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface',
  danger: 'bg-error/10 text-error border border-error/20 hover:bg-error/20',
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-7 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded font-medium',
          'transition-colors duration-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        disabled={disabled ?? isLoading}
        // When loading, aria-busy signals to AT that an operation is in progress
        // (WCAG 4.1.3 Status Messages)
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && (
          <>
            {/* Visible spinner — decorative, real state communicated via aria-busy */}
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
            />
            {/* Screen-reader-only text so AT users hear "Loading" even if
                the button's visible label doesn't change (WCAG 1.3.1) */}
            <span className="sr-only">Loading, please wait</span>
          </>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
